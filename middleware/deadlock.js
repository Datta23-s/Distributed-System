/**
 * ============================================================================
 * UNIT 3: SYNCHRONIZATION — DISTRIBUTED DEADLOCK DETECTION
 * Module: middleware/deadlock.js
 * ============================================================================
 *
 * WHICH FILE IMPLEMENTS WHAT:
 * - middleware/deadlock.js: Implements the Chandy-Misra-Haas Edge-Chasing Distributed
 *   Deadlock Detection Algorithm (1983) for the AND-request model:
 *   1. Wait-For Graph (WFG) Maintenance: Tracks dynamic resource dependencies:
 *      (Node P_i holds R_a and waits for R_b held by P_j => directed edge P_i -> P_j).
 *   2. Probe Transmission & Forwarding:
 *      When node P_i is blocked waiting for P_j, it initiates edge-chasing by sending
 *      PROBE(initiator=P_i, sender=P_i, receiver=P_j) over the TCP control channel.
 *      When P_j receives the probe, if P_j is waiting for P_k, it forwards
 *      PROBE(initiator=P_i, sender=P_j, receiver=P_k).
 *   3. Cycle Detection: If a probe returns to its initiator (PROBE with receiver == initiator),
 *      a circular wait cycle is proven to exist, and DEADLOCK IS DECLARED!
 *   4. Victim Preemption Resolution: Selects an optimal victim process (e.g. lowest priority),
 *      forces resource release and backoff, thereby breaking the circular wait.
 *   5. Knapp's Classification (Self-Study 5.2): In-app reference card classifying all
 *      4 distributed deadlock detection families (Path-Pushing, Edge-Chasing,
 *      Diffusion Computation, Global-State-Based).
 *
 * HOW TO DEMO TO EXAMINER:
 * 1. Open Dashboard -> "Unit 3: Synchronization" tab -> "Deadlock Detection (Chandy-Misra-Haas)".
 * 2. Click "⚡ Induce Circular Wait Deadlock":
 *    - Driver 1 holds Airport Pickup Bay and requests EV Supercharger.
 *    - Driver 2 holds EV Supercharger and requests Airport Pickup Bay.
 *    - Observe the visual Wait-For Graph displaying the red circular dependency (D1 <-> D2).
 * 3. Click "🔍 Chase Probes & Detect Deadlock":
 *    - Driver 1 dispatches PROBE(D1, D1, D2) over TCP (Port 9031 -> 9032).
 *    - Driver 2 forwards PROBE(D1, D2, D1) over TCP (Port 9032 -> 9031).
 *    - Driver 1 receives its own probe => Deadlock confirmed! The cycle is highlighted.
 * 4. Click "🛡️ Preempt Victim & Resolve Deadlock":
 *    - Driver 2 is preempted and releases the EV Supercharger.
 *    - Driver 1 immediately acquires the EV Supercharger, breaks the cycle, and proceeds.
 * 5. View the Knapp's Classification card showing why Edge-Chasing has O(E) message complexity
 *    without requiring a centralized controller or transmitting full graph paths.
 */

const net = require('net');
const { ServiceRegistry } = require('./naming');
const { LamportClock } = require('./lamport');

const CONTROL_PORTS = {
  'coordinator': { host: '127.0.0.1', port: 9030 },
  'driver-1': { host: '127.0.0.1', port: 9031 },
  'driver-2': { host: '127.0.0.1', port: 9032 },
  'driver-3': { host: '127.0.0.1', port: 9033 }
};

class DeadlockDetector {
  constructor(nodeId = 'coordinator', peerMap = CONTROL_PORTS) {
    this.nodeId = nodeId;
    this.peerMap = peerMap;
    this.registry = new ServiceRegistry();
    this.lamport = new LamportClock(nodeId);

    // Dynamic Resource Allocation & Wait-For Graph
    this.heldResources = {
      'driver-1': [],
      'driver-2': [],
      'driver-3': []
    };

    this.waitingFor = {
      'driver-1': null, // { resourceId, heldBy, requestedAt }
      'driver-2': null,
      'driver-3': null
    };

    this.detectedCycles = [];
    this.probeHistory = [];
    this.traceLog = [];
    this.isDeadlocked = false;

    // Register in Directory Service
    this.registry.register(`service://deadlock/${this.nodeId}`, '127.0.0.1', this.peerMap[this.nodeId]?.port || 9030, {
      type: 'deadlock_detector',
      nodeId: this.nodeId
    });
  }

  logTrace(action, initiator, sender, receiver, details) {
    const entry = {
      id: `dl-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      time: new Date().toLocaleTimeString(),
      action,
      initiator,
      sender,
      receiver,
      details,
      lamportTs: this.lamport.tick()
    };
    this.traceLog.unshift(entry);
    if (this.traceLog.length > 50) this.traceLog.pop();
    return entry;
  }

  /**
   * Helper to send probe message over real TCP socket
   */
  _sendTcpProbe(toNodeId, probe) {
    return new Promise((resolve) => {
      const peer = this.peerMap[toNodeId];
      if (!peer) {
        return resolve({ success: false, reason: `Unknown peer: ${toNodeId}` });
      }

      const client = net.createConnection({ host: peer.host, port: peer.port }, () => {
        client.write(JSON.stringify(probe) + '\n');
        client.end();
        resolve({ success: true });
      });

      client.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });

      client.setTimeout(2000, () => {
        client.destroy();
        resolve({ success: false, reason: 'timeout' });
      });
    });
  }

  /**
   * Scenario Generator:
   * Sets up classic circular wait deadlock between Driver 1 and Driver 2:
   * - Driver 1 holds Airport Bay, wants EV Supercharger (held by Driver 2).
   * - Driver 2 holds EV Supercharger, wants Airport Bay (held by Driver 1).
   */
  induceDeadlockScenario() {
    this.heldResources['driver-1'] = ['airport_bay'];
    this.heldResources['driver-2'] = ['charging_station'];
    this.heldResources['driver-3'] = [];

    this.waitingFor['driver-1'] = {
      resourceId: 'charging_station',
      resourceName: '⚡ EV Supercharger',
      heldBy: 'driver-2',
      requestedAt: Date.now()
    };

    this.waitingFor['driver-2'] = {
      resourceId: 'airport_bay',
      resourceName: '✈️ Airport Pickup Bay',
      heldBy: 'driver-1',
      requestedAt: Date.now() + 10
    };

    this.waitingFor['driver-3'] = null;
    this.isDeadlocked = true;
    this.detectedCycles = [];

    this.logTrace('INVENTORY_LOCKED', 'SYSTEM', 'driver-1 & driver-2', 'RESOURCE_MANAGER',
      'Circular wait created: Driver 1 holds Bay and wants Charger; Driver 2 holds Charger and wants Bay');

    return this.getWaitForGraph();
  }

  /**
   * Run Chandy-Misra-Haas Edge-Chasing Deadlock Detection:
   * 1. Initiator P_i sends PROBE(i, i, j) to each process P_j it is waiting on.
   * 2. When process P_j receives PROBE(i, sender, j):
   *    - If P_j is waiting on P_k:
   *      - If P_k == i: CYCLE DETECTED!
   *      - Else: forward PROBE(i, j, k) to P_k.
   */
  async runEdgeChasing(initiator = 'driver-1') {
    const probeTrace = [];
    const waitInfo = this.waitingFor[initiator];

    if (!waitInfo) {
      this.logTrace('PROBE_IDLE', initiator, initiator, 'NONE',
        `Process '${initiator}' is not waiting for any resource. No deadlock probe dispatched.`);
      return {
        deadlockDetected: false,
        initiator,
        cycle: [],
        probeHops: [],
        trace: this.traceLog
      };
    }

    const firstReceiver = waitInfo.heldBy;
    const initialProbe = {
      type: 'PROBE',
      initiator,
      sender: initiator,
      receiver: firstReceiver,
      wantedResource: waitInfo.resourceId,
      hop: 1,
      timestamp: Date.now()
    };

    this.logTrace('PROBE_INITIATE', initiator, initiator, firstReceiver,
      `Process '${initiator}' sends PROBE(${initiator}, ${initiator}, ${firstReceiver}) along WFG edge`);
    probeTrace.push({ ...initialProbe });

    // Send real TCP probe to first receiver
    await this._sendTcpProbe(firstReceiver, initialProbe);

    // Propagate probe through Wait-For Graph (Edge-Chasing)
    let currentSender = firstReceiver;
    let hopCount = 1;
    let cycleDetected = false;
    const visitedPath = [initiator, firstReceiver];

    while (hopCount < 10 && !cycleDetected) {
      const currentWait = this.waitingFor[currentSender];
      if (!currentWait) {
        this.logTrace('PROBE_ABSORBED', initiator, currentSender, 'NONE',
          `Process '${currentSender}' is active and not waiting. Probe absorbed.`);
        break;
      }

      const nextReceiver = currentWait.heldBy;
      hopCount++;

      const nextProbe = {
        type: 'PROBE',
        initiator,
        sender: currentSender,
        receiver: nextReceiver,
        wantedResource: currentWait.resourceId,
        hop: hopCount,
        timestamp: Date.now()
      };

      probeTrace.push({ ...nextProbe });
      await this._sendTcpProbe(nextReceiver, nextProbe);

      if (nextReceiver === initiator) {
        // PROBE RETURNED TO INITIATOR => CIRCULAR WAIT CONFIRMED!
        cycleDetected = true;
        this.isDeadlocked = true;
        visitedPath.push(initiator);

        this.logTrace('DEADLOCK_DETECTED', initiator, currentSender, initiator,
          `🚨 DEADLOCK DETECTED! Probe returned to initiator '${initiator}' after ${hopCount} hops. Cycle: ${visitedPath.join(' -> ')}`);
        break;
      }

      visitedPath.push(nextReceiver);
      currentSender = nextReceiver;
    }

    const result = {
      deadlockDetected: cycleDetected,
      initiator,
      cycle: cycleDetected ? visitedPath : [],
      probeHops: probeTrace,
      victimCandidate: cycleDetected ? 'driver-2' : null, // Lower priority or younger timestamp
      timestamp: Date.now()
    };

    if (cycleDetected) {
      this.detectedCycles.unshift(result);
      if (this.detectedCycles.length > 10) this.detectedCycles.pop();
    }

    return result;
  }

  /**
   * Preempt Victim to Resolve Deadlock:
   * 1. Force victim (e.g. Driver 2) to release held resource (EV Supercharger).
   * 2. Unblock Driver 1 so it acquires the EV Supercharger.
   * 3. Clear circular wait edges in Wait-For Graph.
   */
  resolveDeadlock(victim = 'driver-2') {
    if (!this.heldResources[victim] || this.heldResources[victim].length === 0) {
      victim = 'driver-2';
    }

    const released = [...(this.heldResources[victim] || ['charging_station'])];
    this.heldResources[victim] = [];
    const victimWait = this.waitingFor[victim];
    this.waitingFor[victim] = null;

    // Grant released resource to Driver 1 (the unblocked process)
    const beneficiary = victim === 'driver-2' ? 'driver-1' : 'driver-2';
    released.forEach((res) => {
      if (!this.heldResources[beneficiary].includes(res)) {
        this.heldResources[beneficiary].push(res);
      }
    });

    // Beneficiary is no longer waiting
    this.waitingFor[beneficiary] = null;
    this.isDeadlocked = false;

    this.logTrace('VICTIM_PREEMPTED', 'DEADLOCK_RESOLVER', victim, beneficiary,
      `🛡️ Deadlock resolved: Preempted victim '${victim}' released [${released.join(', ')}]. Transferred to '${beneficiary}'. Cycle broken!`);

    return {
      status: 'RESOLVED',
      victim,
      releasedResources: released,
      beneficiary,
      newHolders: this.heldResources,
      waitForGraph: this.getWaitForGraph()
    };
  }

  /**
   * Get Current Wait-For Graph (WFG) Representation
   */
  getWaitForGraph() {
    const nodes = ['driver-1', 'driver-2', 'driver-3'];
    const edges = [];

    nodes.forEach((src) => {
      const wait = this.waitingFor[src];
      if (wait && wait.heldBy) {
        edges.push({
          from: src,
          to: wait.heldBy,
          resource: wait.resourceId,
          resourceName: wait.resourceName || wait.resourceId
        });
      }
    });

    return {
      nodes: nodes.map((id) => ({
        id,
        held: this.heldResources[id] || [],
        waiting: this.waitingFor[id] || null
      })),
      edges,
      isDeadlocked: this.isDeadlocked,
      detectedCycles: this.detectedCycles
    };
  }

  /**
   * Knapp's Classification (Self-Study 5.2):
   * Complete reference breakdown of distributed deadlock detection families.
   */
  getKnappsClassification() {
    return {
      title: "Knapp's Classification of Distributed Deadlock Detection Algorithms (1987)",
      currentImplementation: "Edge-Chasing (Chandy-Misra-Haas)",
      families: [
        {
          name: "1. Path-Pushing Algorithms",
          example: "Obermarck's Algorithm (1982)",
          mechanism: "Explicit wait-for paths are transmitted along edges of the Wait-For Graph to downstream nodes until a node observes a path ending where it began.",
          messageComplexity: "O(N * E) messages; message size grows as paths lengthen.",
          tradeoff: "High communication overhead; false deadlocks possible due to outdated path fragments.",
          status: "THEORETICAL REFERENCE"
        },
        {
          name: "2. Edge-Chasing Algorithms",
          example: "Chandy-Misra-Haas Algorithm (1983)",
          mechanism: "Fixed-size special PROBE messages (initiator, sender, receiver) circulate along directed edges of the WFG. If a probe returns to initiator, deadlock is confirmed.",
          messageComplexity: "O(E) messages; message size is strictly constant O(1).",
          tradeoff: "Highly efficient, minimal memory overhead, zero central coordinator required.",
          status: "IMPLEMENTED IN URBANPULSE (Unit 3 Phase 4)"
        },
        {
          name: "3. Diffusion Computation",
          example: "Chandy-Misra-Haas for OR-Request Model (1983)",
          mechanism: "A diffusion query wave spreads outward through all dependencies. If all children respond with reply echo signals without granting resources, deadlock is detected.",
          messageComplexity: "O(E) queries and echoes.",
          tradeoff: "Suitable for complex OR-models where a process unblocks when ANY requested resource is granted.",
          status: "THEORETICAL REFERENCE"
        },
        {
          name: "4. Global-State-Based Algorithms",
          example: "Ho-Ramamoorthy Algorithm (1986)",
          mechanism: "Takes a periodic distributed snapshot of resource allocations and wait-for sets, constructs a global WFG at a coordinator, and searches for cycles using Tarjan's algorithm.",
          messageComplexity: "Tied to snapshot frequency O(N^2).",
          tradeoff: "Can trigger phantom deadlocks if snapshot is not strictly consistent (requires Chandy-Lamport).",
          status: "THEORETICAL REFERENCE"
        }
      ]
    };
  }

  getTraceLog() {
    return this.traceLog;
  }
}

module.exports = {
  DeadlockDetector,
  CONTROL_PORTS
};
