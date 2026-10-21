/**
 * Unit 2: Communication - Fault Tolerance & Failure Detection
 * Unit 1: Goals of Distributed Systems - Failure Transparency & Reliability
 *
 * This module implements:
 * 1. Heartbeat receiver and liveness tracker for all driver nodes
 * 2. Background watchdog timer detecting node crashes (missed heartbeats)
 * 3. Automatic failover callback triggering re-dispatching of stranded rides
 */

class HeartbeatMonitor {
  constructor(heartbeatTimeoutMs = 3500, checkIntervalMs = 800) {
    this.heartbeatTimeoutMs = heartbeatTimeoutMs;
    this.checkIntervalMs = checkIntervalMs;
    this.lastSeen = new Map();       // nodeId -> timestamp (ms)
    this.nodeMetadata = new Map();   // nodeId -> metadata object
    this.deadNodes = new Set();
    this.failureCallbacks = [];
    this.timer = null;
  }

  registerFailureCallback(callback) {
    this.failureCallbacks.push(callback);
  }

  recordHeartbeat(nodeId, metadata = {}) {
    this.lastSeen.set(nodeId, Date.now());
    if (metadata) {
      this.nodeMetadata.set(nodeId, metadata);
    }
    if (this.deadNodes.has(nodeId)) {
      this.deadNodes.delete(nodeId);
      // console.log(`[FaultMonitor] Node '${nodeId}' recovered.`);
    }
  }

  markCrashedManually(nodeId) {
    this.lastSeen.set(nodeId, 0); // Force immediate timeout
    this._checkFailures();
  }

  getNodeStatus(nodeId) {
    if (this.deadNodes.has(nodeId)) return 'CRASHED';
    const last = this.lastSeen.get(nodeId) || 0;
    return Date.now() - last > this.heartbeatTimeoutMs ? 'CRASHED' : 'HEALTHY';
  }

  getAllStatuses() {
    const statuses = {};
    const now = Date.now();
    for (const [nid, last] of this.lastSeen.entries()) {
      const isDead = this.deadNodes.has(nid) || (now - last > this.heartbeatTimeoutMs);
      statuses[nid] = {
        nodeId: nid,
        status: isDead ? 'CRASHED' : 'HEALTHY',
        secondsSinceHeartbeat: ((now - last) / 1000).toFixed(1),
        metadata: this.nodeMetadata.get(nid) || {}
      };
    }
    return statuses;
  }

  _checkFailures() {
    const now = Date.now();
    const newlyDead = [];

    for (const [nodeId, lastTs] of this.lastSeen.entries()) {
      if (!this.deadNodes.has(nodeId) && (now - lastTs > this.heartbeatTimeoutMs)) {
        this.deadNodes.add(nodeId);
        newlyDead.push({ nodeId, metadata: this.nodeMetadata.get(nodeId) || {} });
      }
    }

    for (const { nodeId, metadata } of newlyDead) {
      // console.log(`\n⚠️  [FaultMonitor] CRASH DETECTED on node '${nodeId}'!`);
      this.failureCallbacks.forEach((cb) => {
        try {
          cb(nodeId, metadata);
        } catch (e) {
          console.error('[FaultMonitor] Error in failure callback:', e);
        }
      });
    }
  }

  start() {
    if (!this.timer) {
      this.timer = setInterval(() => this._checkFailures(), this.checkIntervalMs);
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

module.exports = {
  HeartbeatMonitor
};
