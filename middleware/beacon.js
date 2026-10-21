/**
 * ============================================================================
 * UNIT 3: SYNCHRONIZATION — DISCOVERY & BEACON PROTOCOL
 * Module: middleware/beacon.js
 * ============================================================================
 *
 * WHICH FILE IMPLEMENTS WHAT:
 * - middleware/beacon.js: Implements decentralized neighbour discovery via periodic
 *   UDP beacons and a localized neighbour status table.
 * - Used by:
 *   - nodes/driver.js (each driver broadcasts beacons every 1 second)
 *   - middleware/election.js (uses neighbour table to know alive candidate nodes)
 *   - middleware/mutex.js (uses neighbour table for peer group membership)
 *   - public/js/Unit3Sync.jsx (renders real-time alive/expired neighbour cards)
 *
 * HOW TO DEMO TO EXAMINER:
 * 1. Open Dashboard -> "Unit 3: Synchronization" tab -> "Neighbour Discovery Table".
 * 2. Point out that Driver 1, Driver 2, and Driver 3 broadcast UDP beacons every 1s.
 * 3. Show the "Last Seen" timer updating dynamically with green "ALIVE" badges.
 * 4. Kill Driver 2 using the fault injection button.
 * 5. Watch Driver 2's badge transition from "ALIVE" to "EXPIRED" after exactly 3.0s,
 *    demonstrating decentralized failure detection without a central registry!
 */

const dgram = require('dgram');

class NeighbourTable {
  constructor(timeoutMs = 3000) {
    this.timeoutMs = timeoutMs;
    this.table = new Map(); // nodeId -> entry
    this.changeListeners = [];
  }

  onChange(listener) {
    this.changeListeners.push(listener);
  }

  notifyChange() {
    const snapshot = this.getAll();
    this.changeListeners.forEach((fn) => {
      try {
        fn(snapshot);
      } catch (e) {}
    });
  }

  updateNeighbour(nodeId, data = {}) {
    const now = Date.now();
    const existing = this.table.get(nodeId);
    const wasAlive = existing ? (now - existing.lastSeen <= this.timeoutMs) : false;

    this.table.set(nodeId, {
      nodeId,
      position: data.position || [0, 0],
      state: data.state || 'AVAILABLE',
      lamportTs: data.lamportTs || 0,
      wallTime: data.wallTime || now,
      lastSeen: now,
      isAlive: true,
      metadata: data.metadata || {}
    });

    if (!wasAlive) {
      this.notifyChange();
    }
  }

  prune() {
    const now = Date.now();
    let stateChanged = false;

    for (const [nodeId, entry] of this.table.entries()) {
      const isAlive = (now - entry.lastSeen <= this.timeoutMs);
      if (entry.isAlive !== isAlive) {
        entry.isAlive = isAlive;
        stateChanged = true;
      }
    }

    if (stateChanged) {
      this.notifyChange();
    }
  }

  getAll() {
    const now = Date.now();
    const result = {};

    for (const [nodeId, entry] of this.table.entries()) {
      const isAlive = (now - entry.lastSeen <= this.timeoutMs);
      result[nodeId] = {
        ...entry,
        isAlive,
        statusBadge: isAlive ? 'ALIVE' : 'EXPIRED',
        secondsAgo: Number(((now - entry.lastSeen) / 1000).toFixed(1))
      };
    }
    return result;
  }

  getAliveNodes() {
    const now = Date.now();
    const alive = [];
    for (const [nodeId, entry] of this.table.entries()) {
      if (now - entry.lastSeen <= this.timeoutMs) {
        alive.push(nodeId);
      }
    }
    return alive;
  }

  markDead(nodeId) {
    if (this.table.has(nodeId)) {
      const entry = this.table.get(nodeId);
      entry.isAlive = false;
      entry.lastSeen = 0;
      this.notifyChange();
    }
  }
}

class BeaconService {
  /**
   * @param {string} nodeId - Local node identity (e.g., 'driver-1')
   * @param {number} beaconPort - UDP port to listen for incoming beacons
   * @param {number[]} peerBeaconPorts - Target peer UDP ports to broadcast beacons to
   * @param {Function} stateProvider - Callback returning { position: [x, y], state, lamportTs }
   */
  constructor(nodeId, beaconPort, peerBeaconPorts = [], stateProvider = null) {
    this.nodeId = nodeId;
    this.beaconPort = parseInt(beaconPort, 10);
    this.peerBeaconPorts = peerBeaconPorts.map((p) => parseInt(p, 10));
    this.stateProvider = stateProvider || (() => ({ position: [0, 0], state: 'AVAILABLE', lamportTs: 0 }));

    this.neighbourTable = new NeighbourTable(3000); // 3s timeout expiry
    this.socket = null;
    this.beaconTimer = null;
    this.pruneTimer = null;
    this.running = false;
  }

  start() {
    return new Promise((resolve) => {
      this.socket = dgram.createSocket('udp4');

      this.socket.on('message', (msg) => {
        try {
          const packet = JSON.parse(msg.toString('utf-8'));
          if (packet.type === 'BEACON' && packet.nodeId !== this.nodeId) {
            this.neighbourTable.updateNeighbour(packet.nodeId, packet);
          }
        } catch (e) {}
      });

      this.socket.bind(this.beaconPort, '127.0.0.1', () => {
        this.running = true;

        // Broadcast periodic beacon every 1 second (Unit 3 Discovery)
        this.beaconTimer = setInterval(() => this.broadcastBeacon(), 1000);

        // Check for neighbour timeouts every 500ms
        this.pruneTimer = setInterval(() => this.neighbourTable.prune(), 500);

        // Send initial beacon immediately
        this.broadcastBeacon();
        resolve();
      });

      this.socket.on('error', () => {});
    });
  }

  broadcastBeacon() {
    if (!this.running || !this.socket) return;
    const currentState = this.stateProvider();

    const packet = {
      type: 'BEACON',
      nodeId: this.nodeId,
      position: currentState.position || [0, 0],
      state: currentState.state || 'AVAILABLE',
      lamportTs: currentState.lamportTs || 0,
      wallTime: Date.now()
    };

    const data = Buffer.from(JSON.stringify(packet), 'utf-8');
    for (const port of this.peerBeaconPorts) {
      if (port !== this.beaconPort) {
        this.socket.send(data, 0, data.length, port, '127.0.0.1', () => {});
      }
    }
  }

  getNeighbours() {
    return this.neighbourTable.getAll();
  }

  getAliveNeighbours() {
    return this.neighbourTable.getAliveNodes();
  }

  stop() {
    this.running = false;
    if (this.beaconTimer) clearInterval(this.beaconTimer);
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

module.exports = {
  NeighbourTable,
  BeaconService
};
