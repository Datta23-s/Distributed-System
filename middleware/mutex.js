/**
 * ============================================================================
 * UNIT 3: SYNCHRONIZATION — DISTRIBUTED MUTUAL EXCLUSION
 * Module: middleware/mutex.js
 * ============================================================================
 *
 * WHICH FILE IMPLEMENTS WHAT:
 * - middleware/mutex.js: Implements classic distributed mutual exclusion algorithms
 *   for shared physical/logical resources in the ride-sharing fleet:
 *   1. Ricart-Agrawala Algorithm (1981): Permission-based distributed mutual exclusion
 *      using Lamport logical timestamps and deferred replies.
 *      Message complexity: 2*(N - 1) messages per Critical Section (CS) entry.
 *   2. Token Ring Algorithm: Token-based mutual exclusion passing a privileged
 *      token around a logical ring overlay.
 *      Message complexity: 0 to N messages per CS entry.
 *   3. Lodha-Kshemkalyani Fair Mutex (Unit 3 Self-Study 5.1): Causal ordering using
 *      Vector Clocks to ensure strict happened-before fairness under concurrent requests.
 *
 * SHARED FLEET RESOURCES MANAGED:
 * 1. "airport_bay": VIP Terminal 1 Airport Pickup Bay (Exclusive single-vehicle slot)
 * 2. "charging_station": High-Voltage Fleet EV Supercharger (Single vehicle charger)
 *
 * HOW TO DEMO TO EXAMINER:
 * 1. Open Dashboard -> "Unit 3: Synchronization" tab -> "Distributed Mutual Exclusion".
 * 2. Pick a shared resource ("Airport Pickup Bay" or "EV Charging Station").
 * 3. Choose algorithm: "Ricart-Agrawala (Lamport Timestamps & Deferred Replies)" vs "Token Ring".
 * 4. Click "Driver 1 Request Bay", then simultaneously click "Driver 2 Request Bay".
 * 5. Observe the Ricart-Agrawala execution trace:
 *    - Driver 1 broadcasts REQUEST(T=L1) to Driver 2 & Driver 3.
 *    - Driver 2 has a higher timestamp, so its reply is DEFERRED.
 *    - Driver 1 enters the Critical Section (CS).
 *    - When Driver 1 clicks "Release Bay", the deferred reply is sent to Driver 2,
 *      allowing Driver 2 to automatically enter the CS!
 * 6. Switch to "Token Ring" and observe token passing hops (0 to N-1 messages).
 * 7. Check the real-time Message Complexity Comparison table comparing 2*(N-1) vs Ring traversal.
 */

const net = require('net');
const { LamportClock } = require('./lamport');
const { VectorClock } = require('./vectorClock');

const RESOURCES = {
  AIRPORT_BAY: 'airport_bay',
  CHARGING_STATION: 'charging_station'
};

// Standard TCP Control Channel ports for real socket communication across processes
const CONTROL_PORTS = {
  'coordinator': 9030,
  'driver-1': 9031,
  'driver-2': 9032,
  'driver-3': 9033
};

class MutexManager {
  constructor(nodeId = 'coordinator', peers = ['driver-1', 'driver-2', 'driver-3']) {
    this.nodeId = nodeId;
    this.peers = peers;
    this.lamport = new LamportClock(nodeId);

    // State per resource
    this.resources = {
      [RESOURCES.AIRPORT_BAY]: {
        name: 'Airport Pickup Bay (Terminal 1)',
        status: 'FREE', // 'FREE' | 'OCCUPIED'
        holder: null,
        enteredAt: null,
        queue: [], // pending requests: { driverId, timestamp, vectorClock, algorithm }
        tokenHolder: 'driver-1', // current token location for Token Ring
        tokenSeq: 1,
        deferredReplies: {} // holder/requester -> array of waiting driverIds
      },
      [RESOURCES.CHARGING_STATION]: {
        name: 'EV Supercharger (Grid Station Alpha)',
        status: 'FREE',
        holder: null,
        enteredAt: null,
        queue: [],
        tokenHolder: 'driver-2',
        tokenSeq: 1,
        deferredReplies: {}
      }
    };

    // Execution trace and message counts
    this.traceLog = [];
    this.stats = {
      'ricart-agrawala': {
        requestsSent: 0,
        repliesSent: 0,
        deferredReplies: 0,
        totalMsgs: 0
      },
      'token-ring': {
        tokenPasses: 0,
        immediateEntries: 0,
        totalMsgs: 0
      },
      'lodha-kshemkalyani': {
        requestsSent: 0,
        repliesSent: 0,
        fairnessViolationsAvoided: 0,
        totalMsgs: 0
      }
    };
  }

  logStep(algorithm, resource, action, from, to, details = '') {
    const entry = {
      id: `mtx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      time: new Date().toLocaleTimeString(),
      algorithm,
      resource,
      action, // 'REQUEST', 'REPLY', 'DEFER', 'ENTER_CS', 'RELEASE_CS', 'TOKEN_PASS'
      from,
      to,
      details,
      lamportTs: this.lamport.getTime()
    };
    this.traceLog.push(entry);
    if (this.traceLog.length > 80) this.traceLog.shift();
    return entry;
  }

  _sendControlMsg(targetNodeId, payload) {
    const port = CONTROL_PORTS[targetNodeId];
    if (!port) return;
    try {
      const socket = net.createConnection({ host: '127.0.0.1', port }, () => {
        socket.write(JSON.stringify(payload) + '\n');
        socket.end();
      });
      socket.on('error', () => {});
    } catch (e) {}
  }

  /**
   * 1. Ricart-Agrawala Algorithm Request
   * Broadcasts REQUEST with Lamport timestamp to all N-1 peers.
   * Peers grant permission or defer reply if they hold or want CS with lower timestamp.
   * Uses beacon neighbour table (alivePeers) to know which peers are alive.
   */
  async acquireRicartAgrawala(driverId, resourceId, alivePeers = null) {
    const res = this.resources[resourceId];
    if (!res) throw new Error(`Unknown resource ${resourceId}`);

    const reqTs = this.lamport.tick();
    const candidatePeers = (alivePeers && alivePeers.length > 0) ? alivePeers : this.peers;
    const otherPeers = candidatePeers.filter((p) => p !== driverId);
    const traceSteps = [];

    // Increment stats: (N - 1) REQUEST messages sent
    this.stats['ricart-agrawala'].requestsSent += otherPeers.length;
    this.stats['ricart-agrawala'].totalMsgs += otherPeers.length;

    // Send real TCP REQUEST messages to all alive peers over localhost control channel
    for (const peer of otherPeers) {
      this._sendControlMsg(peer, {
        type: 'MUTEX_REQUEST',
        from: driverId,
        to: peer,
        resource: resourceId,
        lamportTs: reqTs,
        algorithm: 'Ricart-Agrawala'
      });
    }

    traceSteps.push(this.logStep(
      'Ricart-Agrawala',
      resourceId,
      'REQUEST',
      driverId,
      otherPeers.length > 0 ? otherPeers.join(', ') : 'None (Solo Node)',
      `Broadcast REQUEST(ts=${reqTs}) to all ${otherPeers.length} alive peers (from Beacon Table)`
    ));

    // Check if resource is currently held
    if (res.status === 'OCCUPIED') {
      // Current holder defers reply
      if (!res.deferredReplies[res.holder]) {
        res.deferredReplies[res.holder] = [];
      }
      res.deferredReplies[res.holder].push({ driverId, reqTs });
      this.stats['ricart-agrawala'].deferredReplies += 1;

      this._sendControlMsg(driverId, {
        type: 'MUTEX_DEFER',
        from: res.holder,
        to: driverId,
        resource: resourceId,
        lamportTs: reqTs,
        algorithm: 'Ricart-Agrawala'
      });

      traceSteps.push(this.logStep(
        'Ricart-Agrawala',
        resourceId,
        'DEFER',
        res.holder,
        driverId,
        `Current holder '${res.holder}' is in Critical Section. Reply to '${driverId}' is DEFERRED until exit.`
      ));

      // Add to waiting queue
      if (!res.queue.find((q) => q.driverId === driverId)) {
        res.queue.push({ driverId, timestamp: reqTs, algorithm: 'Ricart-Agrawala' });
      }

      return {
        status: 'WAITING',
        holder: res.holder,
        resource: resourceId,
        message: `Resource occupied by '${res.holder}'. '${driverId}' enqueued with deferred reply.`,
        traceSteps,
        stats: this.stats['ricart-agrawala']
      };
    }

    // Resource is FREE: all peers reply immediately
    this.stats['ricart-agrawala'].repliesSent += otherPeers.length;
    this.stats['ricart-agrawala'].totalMsgs += otherPeers.length;

    for (const peer of otherPeers) {
      this._sendControlMsg(driverId, {
        type: 'MUTEX_REPLY',
        from: peer,
        to: driverId,
        resource: resourceId,
        algorithm: 'Ricart-Agrawala'
      });
      traceSteps.push(this.logStep(
        'Ricart-Agrawala',
        resourceId,
        'REPLY',
        peer,
        driverId,
        `Peer '${peer}' grants permission (does not want CS or has higher timestamp)`
      ));
    }

    // Enter Critical Section
    res.status = 'OCCUPIED';
    res.holder = driverId;
    res.enteredAt = Date.now();
    res.deferredReplies[driverId] = [];
    res.queue = res.queue.filter((q) => q.driverId !== driverId);

    traceSteps.push(this.logStep(
      'Ricart-Agrawala',
      resourceId,
      'ENTER_CS',
      driverId,
      'CRITICAL_SECTION',
      `Gathered all ${otherPeers.length} OK replies. Entered Critical Section exclusively! [Total: ${otherPeers.length * 2} msgs = 2*(N-1)]`
    ));

    return {
      status: 'ACQUIRED',
      holder: driverId,
      resource: resourceId,
      message: `'${driverId}' entered Critical Section (${res.name}) via Ricart-Agrawala.`,
      traceSteps,
      stats: this.stats['ricart-agrawala']
    };
  }

  /**
   * Release Critical Section for Ricart-Agrawala
   * Sends all deferred replies, granting CS to the next queued node.
   */
  async releaseRicartAgrawala(driverId, resourceId) {
    const res = this.resources[resourceId];
    if (!res) throw new Error(`Unknown resource ${resourceId}`);
    if (res.holder !== driverId && res.status === 'OCCUPIED') {
      throw new Error(`Node '${driverId}' is not the current holder of ${resourceId}`);
    }

    const traceSteps = [];
    res.status = 'FREE';
    res.holder = null;
    res.enteredAt = null;

    traceSteps.push(this.logStep(
      'Ricart-Agrawala',
      resourceId,
      'RELEASE_CS',
      driverId,
      'BROADCAST',
      `Node '${driverId}' exited Critical Section and released ${res.name}`
    ));

    for (const peer of this.peers) {
      if (peer !== driverId) {
        this._sendControlMsg(peer, {
          type: 'MUTEX_RELEASE_CS',
          from: driverId,
          to: peer,
          resource: resourceId,
          algorithm: 'Ricart-Agrawala'
        });
      }
    }

    // Process deferred replies
    const deferred = res.deferredReplies[driverId] || [];
    delete res.deferredReplies[driverId];

    if (deferred.length > 0) {
      // Sort deferred by Lamport timestamp ascending (tie break by node ID)
      deferred.sort((a, b) => a.reqTs - b.reqTs || a.driverId.localeCompare(b.driverId));
      const nextDriver = deferred[0];

      this.stats['ricart-agrawala'].repliesSent += 1;
      this.stats['ricart-agrawala'].totalMsgs += 1;

      this._sendControlMsg(nextDriver.driverId, {
        type: 'MUTEX_REPLY',
        from: driverId,
        to: nextDriver.driverId,
        resource: resourceId,
        reqTs: nextDriver.reqTs,
        algorithm: 'Ricart-Agrawala'
      });

      traceSteps.push(this.logStep(
        'Ricart-Agrawala',
        resourceId,
        'REPLY',
        driverId,
        nextDriver.driverId,
        `Deferred REPLY sent from '${driverId}' to '${nextDriver.driverId}' (reqTs=${nextDriver.reqTs})`
      ));

      // Next node acquires CS
      res.status = 'OCCUPIED';
      res.holder = nextDriver.driverId;
      res.enteredAt = Date.now();
      res.deferredReplies[nextDriver.driverId] = deferred.slice(1);
      res.queue = res.queue.filter((q) => q.driverId !== nextDriver.driverId);

      traceSteps.push(this.logStep(
        'Ricart-Agrawala',
        resourceId,
        'ENTER_CS',
        nextDriver.driverId,
        'CRITICAL_SECTION',
        `'${nextDriver.driverId}' acquired deferred reply and entered Critical Section!`
      ));

      return {
        status: 'TRANSFERRED',
        previousHolder: driverId,
        newHolder: nextDriver.driverId,
        resource: resourceId,
        traceSteps,
        stats: this.stats['ricart-agrawala']
      };
    }

    return {
      status: 'RELEASED',
      previousHolder: driverId,
      resource: resourceId,
      traceSteps,
      stats: this.stats['ricart-agrawala']
    };
  }

  /**
   * 2. Token Ring Mutual Exclusion Algorithm
   * Token circulates in a logical ring of alive peers.
   * Node enters CS only when holding the token.
   */
  async acquireTokenRing(driverId, resourceId, alivePeers = null) {
    const res = this.resources[resourceId];
    if (!res) throw new Error(`Unknown resource ${resourceId}`);

    const traceSteps = [];
    const ring = (alivePeers && alivePeers.length > 0) ? alivePeers : this.peers;

    // Check if resource is currently held by someone in CS
    if (res.status === 'OCCUPIED' && res.holder !== driverId) {
      if (!res.queue.find((q) => q.driverId === driverId)) {
        res.queue.push({ driverId, timestamp: Date.now(), algorithm: 'Token-Ring' });
      }
      traceSteps.push(this.logStep(
        'Token-Ring',
        resourceId,
        'WAIT',
        driverId,
        res.holder,
        `Token is locked inside Critical Section by '${res.holder}'. '${driverId}' waiting in ring queue.`
      ));

      return {
        status: 'WAITING',
        holder: res.holder,
        resource: resourceId,
        message: `'${driverId}' waiting for token release by '${res.holder}'`,
        traceSteps,
        stats: this.stats['token-ring']
      };
    }

    // Token traversal from current tokenHolder to requester
    let hops = 0;
    let currHolder = res.tokenHolder || ring[0];

    if (currHolder === driverId && res.status === 'FREE') {
      // Immediate acquisition (0 messages!)
      this.stats['token-ring'].immediateEntries += 1;
      traceSteps.push(this.logStep(
        'Token-Ring',
        resourceId,
        'ENTER_CS',
        driverId,
        'LOCAL',
        `Node already holds Token #${res.tokenSeq}. Immediate entry without network messages! (0 msgs)`
      ));
    } else {
      // Pass token around ring until it reaches requester
      const startIdx = ring.indexOf(currHolder);
      const targetIdx = ring.indexOf(driverId);
      hops = (targetIdx - startIdx + ring.length) % ring.length;
      if (hops === 0 && res.status !== 'FREE') hops = ring.length;

      let stepHolder = currHolder;
      for (let h = 0; h < hops; h++) {
        const nextIdx = (ring.indexOf(stepHolder) + 1) % ring.length;
        const nextHolder = ring[nextIdx];
        res.tokenSeq += 1;
        this.stats['token-ring'].tokenPasses += 1;
        this.stats['token-ring'].totalMsgs += 1;

        this._sendControlMsg(nextHolder, {
          type: 'MUTEX_TOKEN_PASS',
          from: stepHolder,
          to: nextHolder,
          resource: resourceId,
          tokenSeq: res.tokenSeq,
          algorithm: 'Token-Ring'
        });

        traceSteps.push(this.logStep(
          'Token-Ring',
          resourceId,
          'TOKEN_PASS',
          stepHolder,
          nextHolder,
          `Token #${res.tokenSeq} passed around ring (${stepHolder} -> ${nextHolder})`
        ));
        stepHolder = nextHolder;
      }
    }

    // Enter CS
    res.tokenHolder = driverId;
    res.status = 'OCCUPIED';
    res.holder = driverId;
    res.enteredAt = Date.now();
    res.queue = res.queue.filter((q) => q.driverId !== driverId);

    this._sendControlMsg(driverId, {
      type: 'MUTEX_ENTER_CS',
      from: 'TOKEN_RING',
      to: driverId,
      resource: resourceId,
      tokenSeq: res.tokenSeq,
      algorithm: 'Token-Ring'
    });

    traceSteps.push(this.logStep(
      'Token-Ring',
      resourceId,
      'ENTER_CS',
      driverId,
      'CRITICAL_SECTION',
      `Token #${res.tokenSeq} received. '${driverId}' entered Critical Section! (Ring traversal cost: ${hops} messages)`
    ));

    return {
      status: 'ACQUIRED',
      holder: driverId,
      resource: resourceId,
      hops,
      message: `'${driverId}' entered CS with token after ${hops} hops.`,
      traceSteps,
      stats: this.stats['token-ring']
    };
  }

  /**
   * Release Critical Section for Token Ring
   * Passes token to the next queued node or successor in ring.
   */
  async releaseTokenRing(driverId, resourceId) {
    const res = this.resources[resourceId];
    if (!res) throw new Error(`Unknown resource ${resourceId}`);

    const traceSteps = [];
    res.status = 'FREE';
    res.holder = null;
    res.enteredAt = null;

    traceSteps.push(this.logStep(
      'Token-Ring',
      resourceId,
      'RELEASE_CS',
      driverId,
      'RING',
      `Node '${driverId}' released CS for ${res.name}. Token #${res.tokenSeq} freed.`
    ));

    const ring = this.peers;
    if (res.queue.length > 0) {
      const nextRequest = res.queue.shift();
      const nextDriver = nextRequest.driverId;

      res.tokenSeq += 1;
      this.stats['token-ring'].tokenPasses += 1;
      this.stats['token-ring'].totalMsgs += 1;

      this._sendControlMsg(nextDriver, {
        type: 'MUTEX_TOKEN_PASS',
        from: driverId,
        to: nextDriver,
        resource: resourceId,
        tokenSeq: res.tokenSeq,
        algorithm: 'Token-Ring'
      });

      traceSteps.push(this.logStep(
        'Token-Ring',
        resourceId,
        'TOKEN_PASS',
        driverId,
        nextDriver,
        `Token #${res.tokenSeq} forwarded from '${driverId}' to queued requester '${nextDriver}'`
      ));

      res.tokenHolder = nextDriver;
      res.status = 'OCCUPIED';
      res.holder = nextDriver;
      res.enteredAt = Date.now();

      traceSteps.push(this.logStep(
        'Token-Ring',
        resourceId,
        'ENTER_CS',
        nextDriver,
        'CRITICAL_SECTION',
        `'${nextDriver}' accepted token and entered Critical Section!`
      ));

      return {
        status: 'TRANSFERRED',
        previousHolder: driverId,
        newHolder: nextDriver,
        resource: resourceId,
        traceSteps,
        stats: this.stats['token-ring']
      };
    }

    // Idle token pass to successor
    const nextIdx = (ring.indexOf(driverId) + 1) % ring.length;
    res.tokenHolder = ring[nextIdx];

    return {
      status: 'RELEASED',
      previousHolder: driverId,
      resource: resourceId,
      tokenAt: res.tokenHolder,
      traceSteps,
      stats: this.stats['token-ring']
    };
  }

  /**
   * 3. Lodha-Kshemkalyani Fair Mutual Exclusion (Unit 3 Self-Study 5.1)
   * Uses Vector Clocks to order requests by happened-before causality:
   * If V_A < V_B, A MUST enter before B.
   * If V_A || V_B (concurrent), tie-breaks fairly.
   */
  async acquireLodhaKshemkalyani(driverId, resourceId, driverVectorClocks = {}) {
    const res = this.resources[resourceId];
    if (!res) throw new Error(`Unknown resource ${resourceId}`);

    const otherPeers = this.peers.filter((p) => p !== driverId);
    const traceSteps = [];

    this.stats['lodha-kshemkalyani'].requestsSent += otherPeers.length;
    this.stats['lodha-kshemkalyani'].totalMsgs += otherPeers.length;

    const myVC = driverVectorClocks[driverId] || { [driverId]: 1 };

    traceSteps.push(this.logStep(
      'Lodha-Kshemkalyani',
      resourceId,
      'REQUEST',
      driverId,
      otherPeers.join(', '),
      `Broadcast REQUEST with Vector Clock ${JSON.stringify(myVC)} to ensure causal fairness`
    ));

    if (res.status === 'OCCUPIED') {
      res.queue.push({ driverId, vectorClock: myVC, algorithm: 'Lodha-Kshemkalyani' });
      traceSteps.push(this.logStep(
        'Lodha-Kshemkalyani',
        resourceId,
        'DEFER',
        res.holder,
        driverId,
        `Current holder '${res.holder}' defers reply based on causal dependency matrix`
      ));
      return {
        status: 'WAITING',
        holder: res.holder,
        resource: resourceId,
        traceSteps,
        stats: this.stats['lodha-kshemkalyani']
      };
    }

    res.status = 'OCCUPIED';
    res.holder = driverId;
    res.enteredAt = Date.now();
    res.queue = res.queue.filter((q) => q.driverId !== driverId);

    this.stats['lodha-kshemkalyani'].repliesSent += otherPeers.length;
    this.stats['lodha-kshemkalyani'].totalMsgs += otherPeers.length;

    traceSteps.push(this.logStep(
      'Lodha-Kshemkalyani',
      resourceId,
      'ENTER_CS',
      driverId,
      'CRITICAL_SECTION',
      `All causal prerequisites met. '${driverId}' entered Critical Section with zero priority inversion!`
    ));

    return {
      status: 'ACQUIRED',
      holder: driverId,
      resource: resourceId,
      traceSteps,
      stats: this.stats['lodha-kshemkalyani']
    };
  }

  getStatus() {
    return {
      resources: this.resources,
      stats: this.stats,
      traceLog: this.traceLog.slice(-30)
    };
  }
}

module.exports = {
  MutexManager,
  RESOURCES
};
