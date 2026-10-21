/**
 * ============================================================================
 * UNIT 4: EMERGING DISTRIBUTED PARADIGMS — REPLICATED KV STORE WITH TUNABLE QUORUM
 * Module: services/kvstore/quorumKvStore.js
 * ============================================================================
 *
 * WHICH FILE IMPLEMENTS WHAT:
 * - services/kvstore/quorumKvStore.js: Implements an Amazon Dynamo-style replicated
 *   distributed Key-Value store with tunable (N, R, W) Quorum consensus and Read Repair:
 *   1. Tunable Quorum Parameters:
 *      - N = 3 (Total Replicas)
 *      - W = Write Quorum (1 to 3)
 *      - R = Read Quorum (1 to 3)
 *   2. Consistency Classification:
 *      - If R + W > N: Strong Consistency (Strict Quorum: overlap guaranteed).
 *      - If R + W <= N: Eventual Consistency (Risk of reading stale data).
 *   3. Vector Clock Versioning: Resolves multi-version concurrency and detects stale replicas.
 *   4. Asynchronous Read Repair: When a read query observes a stale replica within its quorum,
 *      it writes the latest value back to the stale replica automatically.
 *   5. Network Partition Simulation: Demonstrates CAP theorem (Consistency vs Availability)
 *      by isolating a replica and observing quorum write failures or degraded availability.
 *
 * HOW TO DEMO TO EXAMINER:
 * 1. Open Dashboard -> "Unit 4: Emerging Paradigms" tab -> "Replicated KV Store (Dynamo Quorum)".
 * 2. Set sliders: N=3, W=2, R=2 (R + W = 4 > 3 -> Strong Consistency).
 * 3. Write key 'driver:1:status' = 'ACTIVE' -> 2 replicas acknowledge write.
 * 4. Stale replica injection -> Read with R=2 triggers automatic Read Repair to sync stale node!
 * 5. Click "⚡ Partition Network" -> Isolate Replica 3. Set W=3 -> Writes fail (CAP: Consistency over Availability)!
 */

const { VectorClock } = require('../../middleware/vectorClock');
const { ServiceRegistry } = require('../../middleware/naming');

class QuorumKvStore {
  constructor(N = 3, defaultR = 2, defaultW = 2) {
    this.N = N;
    this.R = defaultR;
    this.W = defaultW;
    this.registry = new ServiceRegistry();

    this.replicas = ['replica-1', 'replica-2', 'replica-3'];

    // In-memory data store per replica: replicaId -> Map(key -> { value, vectorClock, timestamp })
    this.stores = {
      'replica-1': new Map(),
      'replica-2': new Map(),
      'replica-3': new Map()
    };

    // Network partition state
    this.partitionedNodes = new Set(); // nodes partitioned away
    this.operationLog = [];

    this.registry.register('service://kvstore/quorum', '127.0.0.1', 9700, {
      type: 'dynamo_kvstore',
      N: this.N,
      R: this.R,
      W: this.W
    });
  }

  setQuorum(R, W) {
    this.R = Math.max(1, Math.min(this.N, parseInt(R, 10)));
    this.W = Math.max(1, Math.min(this.N, parseInt(W, 10)));
  }

  togglePartition(nodeId) {
    if (this.partitionedNodes.has(nodeId)) {
      this.partitionedNodes.delete(nodeId);
    } else {
      this.partitionedNodes.add(nodeId);
    }
  }

  getHealthyReplicas() {
    return this.replicas.filter((nid) => !this.partitionedNodes.has(nid));
  }

  getConsistencyModel() {
    const isStrong = (this.R + this.W) > this.N;
    return {
      N: this.N,
      R: this.R,
      W: this.W,
      sum: this.R + this.W,
      isStrong,
      level: isStrong ? 'STRONG CONSISTENCY (Strict Quorum: R + W > N)' : 'EVENTUAL CONSISTENCY (Weak Quorum: R + W <= N)',
      capNote: isStrong
        ? 'Guaranteed to read latest write. Replicas must overlap.'
        : 'Faster latency, but client may read stale version if querying non-overlapping replicas.'
    };
  }

  /**
   * Write operation across W replicas
   */
  async write(key, value) {
    const live = this.getHealthyReplicas();
    const t0 = Date.now();

    if (live.length < this.W) {
      const err = `Write Quorum Failed: Needed W=${this.W} replicas, but only ${live.length} healthy replicas reachable!`;
      this.logOp('WRITE', key, value, false, err);
      throw new Error(err);
    }

    // Determine current version and advance vector clock
    let currentMaxClock = {};
    for (const rid of live) {
      const existing = this.stores[rid].get(key);
      if (existing && existing.vectorClock) {
        for (const [k, v] of Object.entries(existing.vectorClock)) {
          currentMaxClock[k] = Math.max(currentMaxClock[k] || 0, v);
        }
      }
    }

    // Advance vector clock on coordinator
    currentMaxClock['coordinator'] = (currentMaxClock['coordinator'] || 0) + 1;

    const record = {
      key,
      value,
      vectorClock: { ...currentMaxClock },
      timestamp: Date.now()
    };

    // Write to first W healthy replicas
    const writtenTo = [];
    for (let i = 0; i < this.W; i++) {
      const targetReplica = live[i];
      this.stores[targetReplica].set(key, record);
      writtenTo.push(targetReplica);
    }

    this.logOp('WRITE', key, value, true, `Wrote to ${writtenTo.length} replicas (${writtenTo.join(', ')}). Version: ${JSON.stringify(currentMaxClock)}`);

    return {
      status: 'OK',
      key,
      value,
      version: currentMaxClock,
      writtenTo,
      quorumAchieved: writtenTo.length >= this.W
    };
  }

  /**
   * Read operation with Read Repair
   */
  async read(key) {
    const live = this.getHealthyReplicas();
    if (live.length < this.R) {
      const err = `Read Quorum Failed: Needed R=${this.R} replicas, but only ${live.length} healthy replicas reachable!`;
      this.logOp('READ', key, null, false, err);
      throw new Error(err);
    }

    // Query R healthy replicas
    const responses = [];
    for (let i = 0; i < this.R; i++) {
      const rid = live[i];
      const entry = this.stores[rid].get(key) || null;
      responses.push({ replicaId: rid, entry });
    }

    // Find the latest version using vector clock comparison
    let latestEntry = null;
    let latestReplicaId = null;
    let staleReplicas = [];

    for (const resp of responses) {
      if (!resp.entry) {
        staleReplicas.push(resp.replicaId);
        continue;
      }

      if (!latestEntry) {
        latestEntry = resp.entry;
        latestReplicaId = resp.replicaId;
      } else {
        const comp = VectorClock.compare(resp.entry.vectorClock, latestEntry.vectorClock);
        if (comp === 'AFTER') {
          if (latestReplicaId) staleReplicas.push(latestReplicaId);
          latestEntry = resp.entry;
          latestReplicaId = resp.replicaId;
        } else if (comp === 'BEFORE') {
          staleReplicas.push(resp.replicaId);
        }
      }
    }

    // Read Repair: If any replica had a stale/missing version, update it asynchronously!
    let readRepairPerformed = false;
    if (latestEntry && staleReplicas.length > 0) {
      readRepairPerformed = true;
      for (const staleId of staleReplicas) {
        if (this.stores[staleId]) {
          this.stores[staleId].set(key, latestEntry);
        }
      }
    }

    const valueFound = latestEntry ? latestEntry.value : null;
    this.logOp('READ', key, valueFound, true,
      `Read from ${responses.length} replicas. Latest value: '${valueFound}'. Read Repair performed: ${readRepairPerformed}`);

    return {
      status: 'OK',
      key,
      value: valueFound,
      version: latestEntry?.vectorClock || {},
      readReplicas: responses.map((r) => r.replicaId),
      readRepairPerformed,
      staleReplicasRepaired: readRepairPerformed ? staleReplicas : []
    };
  }

  logOp(op, key, value, success, details) {
    const entry = {
      id: `kv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      time: new Date().toLocaleTimeString(),
      op,
      key,
      value,
      success,
      details,
      timestamp: Date.now()
    };
    this.operationLog.unshift(entry);
    if (this.operationLog.length > 40) this.operationLog.pop();
  }

  getStatus() {
    const replicaSnapshots = {};
    for (const rid of this.replicas) {
      const items = {};
      for (const [k, v] of this.stores[rid].entries()) {
        items[k] = { value: v.value, version: v.vectorClock };
      }
      replicaSnapshots[rid] = {
        id: rid,
        isHealthy: !this.partitionedNodes.has(rid),
        totalKeys: this.stores[rid].size,
        data: items
      };
    }

    return {
      status: 'OK',
      model: this.getConsistencyModel(),
      replicas: replicaSnapshots,
      partitionedNodes: Array.from(this.partitionedNodes),
      history: this.operationLog.slice(0, 15)
    };
  }
}

module.exports = { QuorumKvStore };
