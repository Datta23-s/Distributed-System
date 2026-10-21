/**
 * ============================================================================
 * UNIT 3: SYNCHRONIZATION — CAUSALITY TRACKING (VECTOR CLOCKS)
 * Module: middleware/vectorClock.js
 * ============================================================================
 *
 * WHICH FILE IMPLEMENTS WHAT:
 * - middleware/vectorClock.js: VectorClock class for detecting causal relationships
 *   (Fidge / Mattern, 1988: "Timestamps in Message-Passing Systems").
 * - Tracks causality across 5 nodes:
 *   ['coordinator', 'driver-1', 'driver-2', 'driver-3', 'customer']
 * - Attached to:
 *   - Ride lifecycle events via MOM ('rides.status')
 *   - P2P traffic hazard gossip packets across drivers
 *   - Causality Inspector on the Dashboard
 *
 * HOW TO DEMO TO EXAMINER:
 * 1. Open Dashboard -> "Unit 3: Synchronization" tab -> "Causality Inspector".
 * 2. Click "Two Drivers Broadcast Hazard Simultaneously".
 *    - Driver 1 broadcasts hazard without knowing about Driver 2's action.
 *    - Driver 2 broadcasts hazard without knowing about Driver 1's action.
 *    - VectorClock.compare(v1, v2) returns "CONCURRENT (A || B)".
 *    - Explain: Neither caused the other; no causal dependency exists!
 * 3. Pick a ride dispatch event vs its completion event in the inspector:
 *    - VectorClock.compare(dispatch, complete) returns "BEFORE (A -> B)".
 *    - Shows that event A causally preceded event B.
 */

const KNOWN_NODES = ['coordinator', 'driver-1', 'driver-2', 'driver-3', 'customer'];

class VectorClock {
  /**
   * @param {string} nodeId - Local node identity (e.g., 'driver-1')
   * @param {Object} initialVector - Optional starting clock map
   */
  constructor(nodeId = 'coordinator', initialVector = null) {
    this.nodeId = nodeId;
    this.clock = {};

    // Initialize all known nodes to 0
    KNOWN_NODES.forEach((nid) => {
      this.clock[nid] = 0;
    });

    if (initialVector && typeof initialVector === 'object') {
      for (const [k, v] of Object.entries(initialVector)) {
        this.clock[k] = parseInt(v || 0, 10);
      }
    }
  }

  /**
   * Local event occurs at `nodeId` (defaults to this.nodeId)
   * @param {string} [nodeId]
   * @returns {Object} cloned vector clock
   */
  tick(nodeId = this.nodeId) {
    this.clock[nodeId] = (this.clock[nodeId] || 0) + 1;
    return this.clone();
  }

  /**
   * Called before sending a message:
   * Increments the sender's component and returns a copy of the vector.
   * @returns {Object} cloned vector clock
   */
  send() {
    this.clock[this.nodeId] = (this.clock[this.nodeId] || 0) + 1;
    return this.clone();
  }

  /**
   * Called upon receiving a message with `remoteVector`:
   * 1. For all k: clock[k] = max(clock[k], remoteVector[k])
   * 2. clock[localNodeId] = clock[localNodeId] + 1
   * @param {Object} remoteVector
   * @returns {Object} updated vector clock copy
   */
  receive(remoteVector) {
    if (remoteVector && typeof remoteVector === 'object') {
      const allKeys = new Set([...Object.keys(this.clock), ...Object.keys(remoteVector)]);
      for (const k of allKeys) {
        const localVal = this.clock[k] || 0;
        const remoteVal = parseInt(remoteVector[k] || 0, 10);
        this.clock[k] = Math.max(localVal, remoteVal);
      }
    }
    this.clock[this.nodeId] = (this.clock[this.nodeId] || 0) + 1;
    return this.clone();
  }

  /**
   * Clones current vector values into a plain object.
   * @returns {Object}
   */
  clone() {
    return { ...this.clock };
  }

  /**
   * Compares two vector clocks A and B.
   * @param {Object} clockA
   * @param {Object} clockB
   * @returns {'EQUAL'|'BEFORE'|'AFTER'|'CONCURRENT'}
   */
  static compare(clockA = {}, clockB = {}) {
    const keys = new Set([...Object.keys(clockA), ...Object.keys(clockB)]);
    let aHasGreater = false;
    let bHasGreater = false;

    for (const k of keys) {
      const valA = parseInt(clockA[k] || 0, 10);
      const valB = parseInt(clockB[k] || 0, 10);

      if (valA > valB) {
        aHasGreater = true;
      } else if (valB > valA) {
        bHasGreater = true;
      }
    }

    if (!aHasGreater && !bHasGreater) {
      return 'EQUAL';
    }
    if (!aHasGreater && bHasGreater) {
      return 'BEFORE'; // A -> B (A happened before B)
    }
    if (aHasGreater && !bHasGreater) {
      return 'AFTER'; // B -> A (A happened after B)
    }
    return 'CONCURRENT'; // A || B (Concurrent events, neither caused the other)
  }

  /**
   * Instance comparison helper
   */
  compareWith(otherClock) {
    return VectorClock.compare(this.clock, otherClock);
  }

  toString() {
    return Object.entries(this.clock)
      .map(([k, v]) => `${k}:${v}`)
      .join(', ');
  }
}

module.exports = {
  VectorClock,
  KNOWN_NODES
};
