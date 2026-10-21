/**
 * ============================================================================
 * UNIT 3: SYNCHRONIZATION — LOGICAL TIME (LAMPORT TIMESTAMPS)
 * Module: middleware/lamport.js
 * ============================================================================
 *
 * WHICH FILE IMPLEMENTS WHAT:
 * - middleware/lamport.js: LamportClock class implementing Lamport's Logical Clocks
 *   (Leslie Lamport, 1978: "Time, Clocks, and the Ordering of Events in a Distributed System").
 * - Used by:
 *   - middleware/rpc.js (piggybacked in RPC requests and responses)
 *   - middleware/broker.js (piggybacked in MOM PUBLISH/ENQUEUE/EVENT packets)
 *   - middleware/p2pMesh.js (piggybacked in UDP Gossip hazard packets)
 *   - nodes/coordinator.js, nodes/driver.js, nodes/customer.js, server.js
 *
 * HOW TO DEMO TO EXAMINER:
 * 1. Open the Dashboard -> Click "Unit 3: Synchronization" tab.
 * 2. Look at the "Ordered Event Log" panel.
 * 3. Trigger events (e.g. Fare Quote, Request Ride, Hazard Broadcast).
 * 4. Observe that every event across all distinct node processes (Coordinator, Driver 1-3,
 *    Customer, Gateway) carries an ever-increasing Lamport logical timestamp L.
 * 5. Explain rule 1 (local tick: L = L + 1) and rule 2 (receive: L = max(L_local, L_msg) + 1).
 *    Even if physical system clocks skew, Lamport logical time guarantees partial order:
 *    a -> b  ==>  L(a) < L(b).
 */

class LamportClock {
  /**
   * @param {string} nodeId - Identifier of the process holding this clock
   * @param {number} initialTime - Starting logical counter (default 0)
   */
  constructor(nodeId = 'node', initialTime = 0) {
    this.nodeId = nodeId;
    this.time = initialTime;
  }

  /**
   * Rule 1: Local event occurs.
   * Increments the clock by 1.
   * @returns {number} updated logical timestamp
   */
  tick() {
    this.time += 1;
    return this.time;
  }

  /**
   * Called before sending a message across the network.
   * Increments clock and returns timestamp to piggyback in the message envelope.
   * @returns {number} timestamp to attach to wire message
   */
  send() {
    this.time += 1;
    return this.time;
  }

  /**
   * Rule 2: Message received with timestamp `receivedTs`.
   * L_local = max(L_local, receivedTs) + 1.
   * Ensures the receive event has a higher timestamp than the send event.
   * @param {number} receivedTs - Lamport timestamp parsed from wire packet
   * @returns {number} updated logical timestamp
   */
  receive(receivedTs) {
    const remote = typeof receivedTs === 'number' ? receivedTs : parseInt(receivedTs || 0, 10);
    this.time = Math.max(this.time, remote) + 1;
    return this.time;
  }

  /**
   * Current logical clock value.
   * @returns {number}
   */
  getTime() {
    return this.time;
  }

  /**
   * Format for logging and serialization
   */
  toJSON() {
    return {
      nodeId: this.nodeId,
      time: this.time
    };
  }
}

module.exports = {
  LamportClock
};
