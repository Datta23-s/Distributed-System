/**
 * Unit 2: Communication - Peer-to-Peer (P2P) Messaging
 * Unit 1: Architectures - Peer-to-Peer & Hybrid Architectures
 *
 * This module implements a decentralized P2P overlay network for Driver nodes:
 * 1. Direct UDP peer-to-peer socket messaging using Node.js 'dgram'
 * 2. Gossip protocol dissemination for traffic hazard alerts
 * 3. Message deduplication (seen-message cache) and Time-To-Live (TTL) to prevent broadcast loops
 * 4. Pure decentralized communication without Coordinator intervention
 */

const dgram = require('dgram');

class P2PNode {
  constructor(nodeId, host, port, lamportClock = null, vectorClock = null) {
    this.nodeId = nodeId;
    this.host = host;
    this.port = port;
    this.peers = new Set();          // array of { host, port }
    this.seenMessages = new Set();   // Deduplication cache
    this.alertCallbacks = [];
    this.socket = null;
    this.lamportClock = lamportClock;
    this.vectorClock = vectorClock;
  }

  setLamportClock(clock) {
    this.lamportClock = clock;
  }

  setVectorClock(clock) {
    this.vectorClock = clock;
  }

  addPeer(host, port) {
    if (host !== this.host || port !== this.port) {
      this.peers.add(`${host}:${port}`);
    }
  }

  onAlert(callback) {
    this.alertCallbacks.push(callback);
  }

  start() {
    return new Promise((resolve) => {
      this.socket = dgram.createSocket('udp4');

      this.socket.on('message', (msg) => {
        try {
          const packet = JSON.parse(msg.toString('utf-8'));
          this._handleIncomingPacket(packet);
        } catch (e) {}
      });

      this.socket.bind(this.port, this.host, () => {
        // console.log(`[P2P Mesh] Node '${this.nodeId}' listening on UDP ${this.host}:${this.port}`);
        resolve();
      });

      this.socket.on('error', () => {});
    });
  }

  _handleIncomingPacket(packet) {
    const { msgId, ttl, lamportTs, vectorClock } = packet;
    if (!msgId || this.seenMessages.has(msgId)) {
      return; // Deduplicate to avoid broadcast storm
    }
    this.seenMessages.add(msgId);

    // Unit 3: Advance local logical time and vector clock
    if (lamportTs && this.lamportClock) {
      this.lamportClock.receive(lamportTs);
    }
    if (vectorClock && this.vectorClock) {
      this.vectorClock.receive(vectorClock);
    }

    // Notify local driver
    this.alertCallbacks.forEach((cb) => {
      try {
        cb(packet);
      } catch (e) {}
    });

    // Forward gossip to other peers if TTL > 1
    if (ttl > 1) {
      packet.ttl = ttl - 1;
      // When forwarding, update Lamport clock
      if (this.lamportClock) {
        packet.lamportTs = this.lamportClock.send();
      }
      this._broadcastToPeers(packet);
    }
  }

  broadcastHazardAlert(hazardType, location, description, customVector = null) {
    const msgId = `p2p-${this.nodeId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const lTs = this.lamportClock ? this.lamportClock.send() : 1;
    const vClock = customVector || (this.vectorClock ? this.vectorClock.send() : null);

    const packet = {
      msgId,
      originNode: this.nodeId,
      hazardType,
      location,
      description,
      timestamp: Date.now(),
      lamportTs: lTs,
      vectorClock: vClock,
      ttl: 3 // Up to 3 hops
    };

    this.seenMessages.add(msgId);
    this._broadcastToPeers(packet);
    return packet;
  }

  _broadcastToPeers(packet) {
    const data = Buffer.from(JSON.stringify(packet), 'utf-8');
    for (const peerStr of this.peers) {
      const [pHost, pPort] = peerStr.split(':');
      this.socket.send(data, 0, data.length, parseInt(pPort, 10), pHost, () => {});
    }
  }

  stop() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

module.exports = {
  P2PNode
};
