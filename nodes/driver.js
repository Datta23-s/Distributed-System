const { ServiceRegistry } = require('../middleware/naming');
const { MessageBrokerClient } = require('../middleware/broker');
const { P2PNode } = require('../middleware/p2pMesh');
const { LamportClock } = require('../middleware/lamport');
const { VectorClock } = require('../middleware/vectorClock');
const { BeaconService } = require('../middleware/beacon');
const { ElectionNode } = require('../middleware/election');

// Standard port mapping for Unit 3 Beacon and Election services
const DRIVER_PORTS = {
  'driver-1': { beacon: 9041, election: 9031 },
  'driver-2': { beacon: 9042, election: 9032 },
  'driver-3': { beacon: 9043, election: 9033 }
};

class DriverNode {
  constructor(driverId, p2pPort, initialX = 20, initialY = 30, peerPorts = [], brokerHost = '127.0.0.1', brokerPort = 9100) {
    this.driverId = driverId;
    this.p2pPort = parseInt(p2pPort, 10);
    this.x = parseFloat(initialX);
    this.y = parseFloat(initialY);
    this.targetX = this.x;
    this.targetY = this.y;
    this.speed = 2.2; // Grid units per second
    this.status = 'AVAILABLE'; // AVAILABLE, PICKING_UP, ON_TRIP, CRASHED

    this.activeRideId = null;
    this.pickupPos = null;
    this.dropoffPos = null;

    this.peerPorts = peerPorts.map((p) => parseInt(p, 10));
    this.brokerHost = brokerHost;
    this.brokerPort = brokerPort;

    // Unit 3: Synchronization - Logical Time per Driver process
    this.lamportClock = new LamportClock(this.driverId);
    this.vectorClock = new VectorClock(this.driverId);

    // Unit 3: Beacon Discovery Protocol (UDP)
    const portInfo = DRIVER_PORTS[this.driverId] || { beacon: 9040, election: 9030 };
    this.beaconPort = portInfo.beacon;
    this.electionPort = portInfo.election;

    this.beacon = new BeaconService(
      this.driverId,
      this.beaconPort,
      [9041, 9042, 9043],
      () => ({
        position: [Number(this.x.toFixed(1)), Number(this.y.toFixed(1))],
        state: this.status,
        lamportTs: this.lamportClock.getTime()
      })
    );

    // Unit 3: Control Channel & Leader Election (Bully & Ring, Snapshot, Deadlock)
    const peerMap = {
      'coordinator': { host: '127.0.0.1', port: 9030 },
      'driver-1': { host: '127.0.0.1', port: 9031 },
      'driver-2': { host: '127.0.0.1', port: 9032 },
      'driver-3': { host: '127.0.0.1', port: 9033 }
    };
    this.election = new ElectionNode(this.driverId, this.electionPort, peerMap);

    // P2P UDP Mesh with Lamport and Vector clocks
    this.p2p = new P2PNode(this.driverId, '127.0.0.1', this.p2pPort, this.lamportClock, this.vectorClock);
    this.p2p.onAlert(this._onP2PHazardReceived.bind(this));

    // MOM Client with Lamport clock
    this.broker = new MessageBrokerClient(this.brokerHost, this.brokerPort, this.lamportClock);

    // Register in Directory Service
    this.registry = new ServiceRegistry();
    this.registry.register(`driver://${this.driverId}`, '127.0.0.1', this.p2pPort, {
      type: 'driver',
      p2pPort: this.p2pPort,
      beaconPort: this.beaconPort,
      electionPort: this.electionPort
    });

    this.crashed = false;
    this.telemetryInterval = null;
    this.heartbeatInterval = null;
    this.knownHazards = [];
  }

  async start() {
    await this.p2p.start();
    await this.beacon.start();
    await this.election.startServer();

    // Register TCP Control Channel handler for Mutual Exclusion, Snapshot, and Deadlock
    this.election.registerHandler((msg) => {
      if (msg.type && msg.type.startsWith('MUTEX_')) {
        console.log(`[${this.driverId} MUTEX TCP] Received ${msg.type} from '${msg.from}' for '${msg.resource || 'resource'}'`);
      } else if (msg.type === 'MARKER') {
        console.log(`[${this.driverId} SNAPSHOT TCP] Received Chandy-Lamport MARKER from '${msg.from}' for Snapshot '${msg.snapshotId}'`);
      } else if (msg.type === 'PROBE') {
        console.log(`[${this.driverId} DEADLOCK TCP] Received Chandy-Misra-Haas PROBE(init=${msg.initiator}, sender=${msg.sender}) waiting for '${msg.wantedResource}'`);
      }
    });

    // Link known peers in the P2P overlay
    this.peerPorts.forEach((port) => {
      this.p2p.addPeer('127.0.0.1', port);
    });

    // Subscribe to driver-specific ride assignments
    this.broker.subscribe(`driver.${this.driverId}.assignments`, this._onAssignmentReceived.bind(this));

    // Start continuous Stream-Oriented Telemetry & Heartbeats
    this._startTelemetryStream();
    this._startHeartbeats();

    console.log(`[${this.driverId}] Node started at (${this.x.toFixed(1)}, ${this.y.toFixed(1)}) | P2P: ${this.p2pPort} | Beacon: ${this.beaconPort} | Election: ${this.electionPort}`);
  }

  // ------------------ Fault Injection ------------------

  simulateCrash() {
    this.crashed = true;
    this.status = 'CRASHED';
    this.beacon.stop();
    console.log(`\n💥 [${this.driverId}] NODE CRASHED! Heartbeats, beacons, and telemetry stopped.`);
  }

  recover() {
    this.crashed = false;
    this.status = 'AVAILABLE';
    this.activeRideId = null;
    this.beacon.start();
    console.log(`✨ [${this.driverId}] Node recovered and back online!`);
  }

  // ------------------ P2P Decentralized Gossip ------------------

  broadcastHazard(hazardType, description) {
    const loc = [Math.round(this.x), Math.round(this.y)];
    const alert = this.p2p.broadcastHazardAlert(hazardType, loc, description);
    console.log(`📢 [${this.driverId} P2P] Broadcasted hazard '${hazardType}' at [${loc}] directly to peer drivers!`);
    return alert;
  }

  _onP2PHazardReceived(packet) {
    this.knownHazards.push(packet);
    console.log(`🔔 [${this.driverId} P2P] Received hazard alert '${packet.hazardType}' from peer '${packet.originNode}' at [${packet.location}]`);
  }

  // ------------------ Assignment & Trip Lifecycle ------------------

  _onAssignmentReceived(topic, payload) {
    if (this.crashed) return;

    if (payload.action === 'ACCEPT_RIDE') {
      if (payload.lamportTs) {
        this.lamportClock.receive(payload.lamportTs);
      }
      if (payload.vectorClock) {
        this.vectorClock.receive(payload.vectorClock);
      }

      this.activeRideId = payload.rideId;
      this.pickupPos = payload.pickup;
      this.dropoffPos = payload.dropoff;
      this.status = 'PICKING_UP';
      this.targetX = parseFloat(this.pickupPos[0]);
      this.targetY = parseFloat(this.pickupPos[1]);

      if (payload.failover) {
        console.log(`🚨 [${this.driverId}] ACCEPTED FAILOVER RIDE '${this.activeRideId}' (replaced crashed ${payload.previousDriver})`);
      } else {
        console.log(`🚕 [${this.driverId}] Accepted Ride '${this.activeRideId}' -> Heading to Pickup [${this.pickupPos}]`);
      }

      const lTs = this.lamportClock.send();
      const vClock = this.vectorClock.send();

      this.broker.publish('rides.status', {
        event: 'DRIVER_EN_ROUTE_PICKUP',
        rideId: this.activeRideId,
        driverId: this.driverId,
        lamportTs: lTs,
        vectorClock: vClock
      });
    }
  }

  // ------------------ Stream-Oriented Telemetry Loop ------------------

  _startTelemetryStream() {
    let lastTime = Date.now();

    this.telemetryInterval = setInterval(() => {
      if (this.crashed) return;

      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      this._updatePosition(dt);

      // Continuous Stream Packet pushed to MOM Broker (Telemetry stream does NOT tick Lamport time)
      this.broker.publish('driver.telemetry', {
        driverId: this.driverId,
        x: Number(this.x.toFixed(2)),
        y: Number(this.y.toFixed(2)),
        status: this.status,
        activeRide: this.activeRideId,
        p2pPort: this.p2pPort,
        timestamp: now
      });
    }, 400); // 2.5 Hz continuous stream
  }

  _updatePosition(dt) {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 0.5) {
      const step = Math.min(dist, this.speed * dt * 4.5);
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    } else {
      // Arrived at current target waypoint
      if (this.status === 'PICKING_UP') {
        this.status = 'ON_TRIP';
        this.targetX = parseFloat(this.dropoffPos[0]);
        this.targetY = parseFloat(this.dropoffPos[1]);
        console.log(`🙋 [${this.driverId}] Arrived at customer! Trip started -> Heading to Dropoff [${this.dropoffPos}]`);

        const lTs = this.lamportClock.send();
        const vClock = this.vectorClock.send();

        this.broker.publish('rides.status', {
          event: 'CUSTOMER_PICKED_UP',
          rideId: this.activeRideId,
          driverId: this.driverId,
          lamportTs: lTs,
          vectorClock: vClock
        });

      } else if (this.status === 'ON_TRIP') {
        console.log(`🏁 [${this.driverId}] Arrived at destination! Ride '${this.activeRideId}' COMPLETED!`);
        this.status = 'AVAILABLE';
        const finishedId = this.activeRideId;
        this.activeRideId = null;

        const lTs = this.lamportClock.send();
        const vClock = this.vectorClock.send();

        this.broker.publish('driver.trip_completed', {
          rideId: finishedId,
          driverId: this.driverId,
          lamportTs: lTs,
          vectorClock: vClock
        });

        this.broker.publish('rides.status', {
          event: 'RIDE_COMPLETED',
          rideId: finishedId,
          driverId: this.driverId,
          lamportTs: lTs,
          vectorClock: vClock
        });

      } else if (this.status === 'AVAILABLE') {
        // Idle wandering on the city grid
        if (Math.random() < 0.08) {
          this.targetX = Math.max(5, Math.min(95, this.x + (Math.random() * 30 - 15)));
          this.targetY = Math.max(5, Math.min(95, this.y + (Math.random() * 30 - 15)));
        }
      }
    }
  }

  _startHeartbeats() {
    this.heartbeatInterval = setInterval(() => {
      if (!this.crashed) {
        this.broker.publish('driver.heartbeat', {
          driverId: this.driverId,
          status: this.status,
          x: Number(this.x.toFixed(2)),
          y: Number(this.y.toFixed(2)),
          timestamp: Date.now()
        });
      }
    }, 1000);
  }

  getClocks() {
    return {
      lamportTs: this.lamportClock.getTime(),
      vectorClock: this.vectorClock.clone()
    };
  }

  getNeighbours() {
    return this.beacon ? this.beacon.getNeighbours() : {};
  }

  getElectionStatus() {
    return {
      currentLeader: this.election ? this.election.currentLeader : 'coordinator',
      isLeader: this.election ? this.election.isLeader : false,
      stats: this.election ? this.election.stats : {}
    };
  }

  stop() {
    if (this.telemetryInterval) clearInterval(this.telemetryInterval);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.beacon) this.beacon.stop();
    if (this.election) this.election.stop();
    this.p2p.stop();
    this.broker.close();
  }
}

// CLI Execution support: node driver.js <id> <p2pPort> <x> <y> <peerPorts...>
if (require.main === module) {
  const args = process.argv.slice(2);
  const id = args[0] || 'driver-1';
  const p2pPort = parseInt(args[1] || '9021', 10);
  const x = parseFloat(args[2] || '20');
  const y = parseFloat(args[3] || '30');
  const peerPorts = args.slice(4).map((p) => parseInt(p, 10));

  const driver = new DriverNode(id, p2pPort, x, y, peerPorts);
  driver.start().then(() => {
    console.log(`[Driver Process ${id}] Running. Press Ctrl+C to stop.`);
  });
}

module.exports = {
  DriverNode
};
