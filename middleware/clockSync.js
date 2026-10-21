/**
 * ============================================================================
 * UNIT 3: SYNCHRONIZATION — PHYSICAL CLOCK SYNCHRONIZATION
 * Module: middleware/clockSync.js
 * ============================================================================
 *
 * WHICH FILE IMPLEMENTS WHAT:
 * - middleware/clockSync.js: Implements physical clock synchronization for distributed
 *   processes with simulated hardware clock skews and drift rates:
 *   1. Cristian's Algorithm (1989): Client-server clock synchronization compensating
 *      for asymmetric/symmetric network transmission delays using RTT/2.
 *      Error bound: ±(RTT/2 - minRTT).
 *   2. Berkeley Algorithm (Gusella & Zatti, 1989): Master-driven active polling
 *      averaging algorithm with fault-tolerant outlier filtering and symmetric adjustments.
 *
 * SIMULATED CLOCK SKEW & DRIFT:
 * - Each distributed node (Coordinator, Driver 1, 2, 3, Customer) possesses an independent
 *   skewed local clock offset (±500ms) and hardware oscillator drift (±15 ppm).
 * - Clearly labelled as simulated physical clock hardware.
 *
 * HOW TO DEMO TO EXAMINER:
 * 1. Open Dashboard -> "Unit 3: Synchronization" tab -> "Physical Clock Synchronization".
 * 2. Observe the initial skewed offsets per node (e.g., Driver 1: +320ms, Driver 2: -410ms).
 * 3. Choose algorithm: "Cristian's Algorithm (RTT/2 Compensation)" or "Berkeley Algorithm".
 * 4. Click "⚡ Sync Clocks Now".
 * 5. Observe the synchronization trace:
 *    - Cristian: Nodes query the Time Server (Coordinator) and adjust by T_server + RTT/2.
 *    - Berkeley: Coordinator polls all nodes, calculates fault-tolerant average, and sends
 *      relative adjustments (+Δ / -Δ) to synchronize the entire cluster.
 * 6. View the Before vs After Offset comparison table showing clock convergence to ~0ms.
 * 7. Click "🎲 Induce Random Skew (±500ms)" to re-skew clocks and demo convergence again!
 */

class SimulatedClock {
  /**
   * @param {string} nodeId - Identifier for the node
   * @param {number} initialOffsetMs - Offset from true wall clock in ms (e.g., +300 or -400)
   * @param {number} driftPpm - Drift rate in parts-per-million (e.g., +10 or -15)
   */
  constructor(nodeId, initialOffsetMs = 0, driftPpm = 0) {
    this.nodeId = nodeId;
    this.offsetMs = parseFloat(initialOffsetMs);
    this.driftPpm = parseFloat(driftPpm);
    this.baseTime = Date.now();
  }

  /**
   * Get simulated local physical clock time
   */
  getTime() {
    const elapsed = Date.now() - this.baseTime;
    const driftMs = (elapsed * this.driftPpm) / 1000000;
    return Date.now() + this.offsetMs + driftMs;
  }

  getOffset() {
    const elapsed = Date.now() - this.baseTime;
    const driftMs = (elapsed * this.driftPpm) / 1000000;
    return Number((this.offsetMs + driftMs).toFixed(2));
  }

  adjust(deltaMs) {
    this.offsetMs += deltaMs;
  }

  setOffset(offsetMs) {
    this.offsetMs = parseFloat(offsetMs);
    this.baseTime = Date.now();
  }
}

class ClockSyncManager {
  constructor() {
    // Initial realistic hardware clock skews across the 5 distributed nodes
    this.clocks = {
      'coordinator': new SimulatedClock('coordinator', 0, 0),         // Reference Time Server
      'driver-1': new SimulatedClock('driver-1', 320, 8),             // Fast clock (+320ms)
      'driver-2': new SimulatedClock('driver-2', -410, -12),          // Slow clock (-410ms)
      'driver-3': new SimulatedClock('driver-3', 215, 5),             // Fast clock (+215ms)
      'customer': new SimulatedClock('customer', -180, -4)            // Slow clock (-180ms)
    };

    this.history = [];
    this.offsetTimeline = [];
    this.recordTimelinePoint('Initial State');
  }

  recordTimelinePoint(label = 'Sync Event') {
    const point = {
      id: `pt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      time: new Date().toLocaleTimeString(),
      label,
      offsets: {}
    };
    for (const [nodeId, clk] of Object.entries(this.clocks)) {
      point.offsets[nodeId] = clk.getOffset();
    }
    this.offsetTimeline.push(point);
    if (this.offsetTimeline.length > 25) this.offsetTimeline.shift();
    return point;
  }

  getClockStatuses() {
    const statuses = {};
    for (const [nodeId, clk] of Object.entries(this.clocks)) {
      statuses[nodeId] = {
        nodeId,
        offsetMs: clk.getOffset(),
        driftPpm: clk.driftPpm,
        simulatedTime: new Date(clk.getTime()).toISOString()
      };
    }
    return statuses;
  }

  /**
   * Randomize clock offsets (±500ms) to allow live examiner demonstrations
   */
  induceRandomSkew() {
    const randomOffsets = {
      'coordinator': 0, // Reference remains stable
      'driver-1': Math.floor((Math.random() * 800) - 400),
      'driver-2': Math.floor((Math.random() * 800) - 400),
      'driver-3': Math.floor((Math.random() * 800) - 400),
      'customer': Math.floor((Math.random() * 600) - 300)
    };

    for (const [nodeId, offset] of Object.entries(randomOffsets)) {
      if (this.clocks[nodeId]) {
        this.clocks[nodeId].setOffset(offset);
      }
    }

    this.recordTimelinePoint('Random Skew Injected');
    return this.getClockStatuses();
  }

  /**
   * 1. Cristian's Algorithm
   * Clients query the Time Server (Coordinator) and adjust clock by:
   * T_new = T_server + RTT / 2
   */
  async runCristiansAlgorithm(simulatedNetworkDelay = 12) {
    const beforeOffsets = this.getClockStatuses();
    const serverClock = this.clocks['coordinator'];
    const clients = ['driver-1', 'driver-2', 'driver-3', 'customer'];
    const traceSteps = [];
    const adjustments = {};

    for (const clientId of clients) {
      const clientClock = this.clocks[clientId];
      
      // Step 1: Client notes T0 (local request time)
      const t0 = clientClock.getTime();
      
      // Step 2: Request travels to server with simulated network transit
      const transitOut = simulatedNetworkDelay + Math.floor(Math.random() * 6) - 3;
      const tServer = serverClock.getTime() + transitOut;
      
      // Step 3: Response travels back to client
      const transitBack = simulatedNetworkDelay + Math.floor(Math.random() * 6) - 3;
      const t1 = t0 + transitOut + transitBack;
      
      // Cristian's calculation
      const rtt = t1 - t0;
      const rttHalf = rtt / 2;
      const estimatedTrueTime = tServer + rttHalf;
      
      // Clock adjustment: Delta = estimatedTrueTime - T1
      const delta = estimatedTrueTime - t1;
      adjustments[clientId] = Number(delta.toFixed(2));
      
      // Accuracy error bound: ±(RTT/2 - minRTT)
      const minRtt = 4;
      const errorBound = Number(Math.max(1, rttHalf - minRtt).toFixed(2));

      // Apply adjustment to client clock
      clientClock.adjust(delta);

      traceSteps.push({
        nodeId: clientId,
        t0: Number(t0.toFixed(1)),
        tServer: Number(tServer.toFixed(1)),
        t1: Number(t1.toFixed(1)),
        rtt: Number(rtt.toFixed(1)),
        rttHalf: Number(rttHalf.toFixed(1)),
        delta: Number(delta.toFixed(2)),
        errorBound: `±${errorBound}ms`,
        formula: `T_new = ${tServer.toFixed(0)} + (${rtt.toFixed(0)} / 2) => adjustment: ${delta > 0 ? '+' : ''}${delta.toFixed(1)}ms`
      });
    }

    const afterOffsets = this.getClockStatuses();
    const summary = {
      id: `cristian-${Date.now()}`,
      time: new Date().toLocaleTimeString(),
      algorithm: "Cristian's Algorithm",
      referenceServer: 'coordinator',
      beforeOffsets,
      afterOffsets,
      traceSteps,
      adjustments
    };

    this.recordTimelinePoint("Cristian's Sync (RTT/2)");
    this.history.unshift(summary);
    if (this.history.length > 10) this.history.pop();
    summary.offsetTimeline = this.offsetTimeline;
    return summary;
  }

  /**
   * 2. Berkeley Algorithm
   * Coordinator actively polls all nodes, estimates their times, calculates
   * the fault-tolerant average, and sends adjustments to each node.
   */
  async runBerkeleyAlgorithm(simulatedNetworkDelay = 10) {
    const beforeOffsets = this.getClockStatuses();
    const masterClock = this.clocks['coordinator'];
    const masterTime = masterClock.getTime();
    const slaves = ['driver-1', 'driver-2', 'driver-3', 'customer'];
    const polledTimes = {};
    const traceSteps = [];

    // Step 1: Master polls all slaves
    const estimatedTimes = [masterTime];
    polledTimes['coordinator'] = {
      localTime: masterTime,
      rtt: 0,
      estimatedTime: masterTime
    };

    for (const slaveId of slaves) {
      const slaveClock = this.clocks[slaveId];
      const rtt = (simulatedNetworkDelay * 2) + Math.floor(Math.random() * 6) - 3;
      const slaveTime = slaveClock.getTime();
      const estimatedTime = slaveTime + (rtt / 2);

      polledTimes[slaveId] = {
        localTime: slaveTime,
        rtt,
        estimatedTime
      };

      // Fault tolerance: Filter out extreme outliers (e.g., clocks off by > 1500ms)
      if (Math.abs(estimatedTime - masterTime) < 1500) {
        estimatedTimes.push(estimatedTime);
      }
    }

    // Step 2: Master calculates fault-tolerant average
    const avgTime = estimatedTimes.reduce((a, b) => a + b, 0) / estimatedTimes.length;

    // Step 3: Calculate adjustments for each node (including master itself!)
    const adjustments = {};
    for (const [nodeId, clk] of Object.entries(this.clocks)) {
      const polled = polledTimes[nodeId];
      const currentEst = polled ? polled.estimatedTime : clk.getTime();
      const delta = avgTime - currentEst;
      adjustments[nodeId] = Number(delta.toFixed(2));
      clk.adjust(delta);

      traceSteps.push({
        nodeId,
        polledTime: polled ? Number(polled.localTime.toFixed(1)) : 0,
        rtt: polled ? Number(polled.rtt.toFixed(1)) : 0,
        delta: Number(delta.toFixed(2)),
        action: delta >= 0 ? `Advance by +${delta.toFixed(1)}ms` : `Slow down by ${delta.toFixed(1)}ms`
      });
    }

    const afterOffsets = this.getClockStatuses();
    const summary = {
      id: `berkeley-${Date.now()}`,
      time: new Date().toLocaleTimeString(),
      algorithm: 'Berkeley Algorithm',
      masterNode: 'coordinator',
      computedAverageTime: new Date(avgTime).toISOString(),
      beforeOffsets,
      afterOffsets,
      traceSteps,
      adjustments
    };

    this.recordTimelinePoint('Berkeley Sync (Average)');
    this.history.unshift(summary);
    if (this.history.length > 10) this.history.pop();
    summary.offsetTimeline = this.offsetTimeline;
    return summary;
  }
}

module.exports = {
  SimulatedClock,
  ClockSyncManager
};
