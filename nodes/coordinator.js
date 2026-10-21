

const net = require('net');
const { ServiceRegistry, generateId } = require('../middleware/naming');
const { RPCServerSkeleton } = require('../middleware/rpc');
const { MessageBrokerServer, MessageBrokerClient } = require('../middleware/broker');
const { HeartbeatMonitor } = require('../middleware/faultMonitor');
const { LamportClock } = require('../middleware/lamport');
const { VectorClock } = require('../middleware/vectorClock');
const { RTreeIndex } = require('../middleware/rTreeIndex');

class CoordinatorNode {
  constructor(host = '127.0.0.1', rpcPort = 9000, brokerPort = 9100, controlPort = 9030) {
    this.host = host;
    this.rpcPort = rpcPort;
    this.brokerPort = brokerPort;
    this.controlPort = controlPort;

    // Unit 3: Synchronization - Logical Time
    this.lamportClock = new LamportClock('coordinator');
    this.vectorClock = new VectorClock('coordinator');

    // Unit 4: Geo-Spatial Indexing
    this.rTree = new RTreeIndex(4);

    this.registry = new ServiceRegistry();
    this.registry.register('service://coordinator', host, rpcPort, { type: 'coordinator' });

    // In-memory cluster state
    this.drivers = new Map();       // driverId -> { driverId, x, y, status, lastSeen }
    this.activeRides = new Map();   // rideId -> rideData
    this.driverToRide = new Map();  // driverId -> rideId

    // Fault Tolerance: Heartbeat Monitor
    this.faultMonitor = new HeartbeatMonitor(3500, 800);
    this.faultMonitor.registerFailureCallback(this._onDriverCrashed.bind(this));

    // RPC Server Skeleton with Lamport clock integration
    this.rpcSkeleton = new RPCServerSkeleton(this.host, this.rpcPort, this.lamportClock);
    this.rpcSkeleton.registerProcedure('estimate_fare', this.rpcEstimateFare.bind(this));
    this.rpcSkeleton.registerProcedure('request_ride', this.rpcRequestRide.bind(this));
    this.rpcSkeleton.registerProcedure('get_trip_status', this.rpcGetTripStatus.bind(this));
    this.rpcSkeleton.registerProcedure('kill_driver_simulation', this.rpcKillDriverSimulation.bind(this));
    this.rpcSkeleton.registerProcedure('get_clocks', this.rpcGetClocks.bind(this));
    this.rpcSkeleton.registerProcedure('get_spatial_index', async () => ({ status: 'OK', spatial: this.rTree.getStatus() }));

    // MOM Broker with Lamport clock integration
    this.brokerServer = new MessageBrokerServer(this.host, this.brokerPort, this.lamportClock);
    this.brokerClient = new MessageBrokerClient(this.host, this.brokerPort, this.lamportClock);
  }

  async rpcGetClocks() {
    return {
      status: 'OK',
      lamportTs: this.lamportClock.getTime(),
      vectorClock: this.vectorClock.clone()
    };
  }

  async start(embeddedBroker = true) {
    if (embeddedBroker) {
      await this.brokerServer.start();
    }
    await this.rpcSkeleton.start();
    this.faultMonitor.start();

    // Subscribe to driver telemetry and heartbeats
    this.brokerClient.subscribe('driver.telemetry', this._onDriverTelemetry.bind(this));
    this.brokerClient.subscribe('driver.heartbeat', this._onDriverHeartbeat.bind(this));
    this.brokerClient.subscribe('driver.trip_completed', (topic, payload) => {
      const { rideId, driverId } = payload;
      if (this.activeRides.has(rideId)) {
        const r = this.activeRides.get(rideId);
        r.status = 'COMPLETED';
        r.completedAt = Date.now();
      }
      this.driverToRide.delete(driverId);
      if (this.drivers.has(driverId)) {
        this.drivers.get(driverId).status = 'AVAILABLE';
      }
    });
    // Control channel TCP server (Port 9030: Mutex, Snapshot, Deadlock)
    this.onControlMessage = (msg) => {
      if (msg.type === 'MARKER') {
        console.log(`[Coordinator SNAPSHOT TCP] Received MARKER from '${msg.from}' for Snapshot '${msg.snapshotId}'`);
      } else if (msg.type === 'PROBE') {
        console.log(`[Coordinator DEADLOCK TCP] Received PROBE(init=${msg.initiator}, sender=${msg.sender}) for '${msg.wantedResource}'`);
      } else if (msg.type && msg.type.startsWith('MUTEX_')) {
        console.log(`[Coordinator MUTEX TCP] Received ${msg.type} from '${msg.from}' for '${msg.resource || 'resource'}'`);
      }
    };

    this.controlServer = net.createServer((socket) => {
      let buffer = '';
      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf-8');
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (line) {
            try {
              const msg = JSON.parse(line);
              if (this.onControlMessage) this.onControlMessage(msg, socket);
            } catch (e) { }
          }
        }
      });
      socket.on('error', () => { });
    });
    this.controlServer.listen(this.controlPort, '127.0.0.1', () => {
      console.log(`[Coordinator] Control TCP Channel listening on 127.0.0.1:${this.controlPort}`);
    });

    console.log(`[Coordinator] Started successfully. RPC Port: ${this.rpcPort}, MOM Port: ${this.brokerPort}, Control: ${this.controlPort}`);
  }

  // ------------------ RPC Procedures ------------------

  async rpcEstimateFare(params) {
    const { pickup, dropoff } = params;
    const dx = dropoff[0] - pickup[0];
    const dy = dropoff[1] - pickup[1];
    const dist = Math.hypot(dx, dy);
    const baseFare = 5.00;
    const fare = Number((baseFare + dist * 1.75).toFixed(2));
    const etaSeconds = Math.max(5, Math.round(dist * 2.5));

    return {
      status: 'OK',
      distanceKm: Number(dist.toFixed(2)),
      estimatedFare: fare,
      etaSeconds
    };
  }

  async rpcRequestRide(params) {
    const { customerId, pickup, dropoff } = params;
    const rideId = generateId('ride');
    const bestDriver = this._findNearestDriver(pickup);

    if (!bestDriver) {
      return {
        status: 'FAILED',
        message: 'No available healthy drivers found. Please retry in a few seconds.'
      };
    }

    const driverId = bestDriver.driverId;
    const vClock = this.vectorClock.send();
    const lTs = this.lamportClock.send();

    const rideData = {
      rideId,
      customerId,
      driverId,
      pickup,
      dropoff,
      status: 'DISPATCHED',
      reassignedCount: 0,
      createdAt: Date.now(),
      lamportTs: lTs,
      vectorClock: vClock
    };

    this.activeRides.set(rideId, rideData);
    this.driverToRide.set(driverId, rideId);
    if (this.drivers.has(driverId)) {
      this.drivers.get(driverId).status = 'ASSIGNED';
    }

    // Publish direct assignment to Driver via MOM
    await this.brokerClient.publish(`driver.${driverId}.assignments`, {
      action: 'ACCEPT_RIDE',
      rideId,
      pickup,
      dropoff,
      customerId,
      lamportTs: lTs,
      vectorClock: vClock
    });

    // Broadcast event to Customer & Dashboard
    await this.brokerClient.publish('rides.status', {
      event: 'RIDE_DISPATCHED',
      ride: rideData,
      lamportTs: lTs,
      vectorClock: vClock
    });

    return {
      status: 'OK',
      rideId,
      driverId,
      driverLocation: [bestDriver.x, bestDriver.y],
      message: `Driver '${driverId}' assigned and heading to pickup!`,
      lamportTs: lTs,
      vectorClock: vClock
    };
  }

  async rpcGetTripStatus(params) {
    const { rideId } = params;
    const ride = this.activeRides.get(rideId);
    if (!ride) {
      return { status: 'NOT_FOUND' };
    }
    const dinfo = this.drivers.get(ride.driverId) || {};
    return {
      status: 'OK',
      ride,
      driverLocation: [dinfo.x || 0, dinfo.y || 0]
    };
  }

  async rpcKillDriverSimulation(params) {
    const { driverId } = params;
    this.faultMonitor.markCrashedManually(driverId);
    return { status: 'OK', message: `Crash simulation signaled for ${driverId}` };
  }

  // ------------------ Fault Tolerance & Automatic Failover ------------------

  async _onDriverCrashed(driverId, metadata) {
    console.log(`\n⚠️  [Coordinator FAULT DETECTOR] CRASH DETECTED on node '${driverId}'!`);

    if (this.drivers.has(driverId)) {
      this.drivers.get(driverId).status = 'CRASHED';
    }

    const rideId = this.driverToRide.get(driverId);
    if (!rideId) return; // Driver wasn't handling an active ride

    const ride = this.activeRides.get(rideId);
    if (!ride || ride.status === 'COMPLETED' || ride.status === 'CANCELLED') return;

    console.log(`🔄 [Coordinator FAILOVER] Stranded ride '${rideId}' detected! Initiating automatic reassignment...`);
    this.driverToRide.delete(driverId);

    // Find a replacement healthy driver
    const replacement = this._findNearestDriver(ride.pickup, [driverId]);
    if (!replacement) {
      console.log('❌ [Coordinator FAILOVER] No alternative healthy drivers available!');
      ride.status = 'FAILED_NO_DRIVERS';
      await this.brokerClient.publish('rides.status', {
        event: 'RIDE_FAILED_NO_DRIVERS',
        ride,
        crashedDriver: driverId
      });
      return;
    }

    const newDriverId = replacement.driverId;
    ride.driverId = newDriverId;
    ride.reassignedCount += 1;
    ride.status = 'REASSIGNED_FAILOVER';
    this.driverToRide.set(newDriverId, rideId);
    if (this.drivers.has(newDriverId)) {
      this.drivers.get(newDriverId).status = 'ASSIGNED';
    }

    console.log(`✅ [Coordinator FAILOVER] Ride '${rideId}' successfully re-dispatched to '${newDriverId}'!`);

    // Notify replacement driver via MOM
    await this.brokerClient.publish(`driver.${newDriverId}.assignments`, {
      action: 'ACCEPT_RIDE',
      rideId,
      pickup: ride.pickup,
      dropoff: ride.dropoff,
      customerId: ride.customerId,
      failover: true,
      previousDriver: driverId
    });

    // Broadcast failover update (Customer updates driver info with zero data loss!)
    await this.brokerClient.publish('rides.status', {
      event: 'RIDE_REASSIGNED_FAILOVER',
      ride,
      crashedDriver: driverId,
      newDriver: newDriverId
    });
  }

  // ------------------ Matchmaking ------------------

  _findNearestDriver(pickup, excludeIds = []) {
    // 1. Primary: Use O(log N) R-Tree Geo-Spatial Index
    const candidates = this.rTree.nearest(pickup[0], pickup[1], 5, (item) => {
      if (excludeIds.includes(item.id)) return false;
      if (this.faultMonitor.getNodeStatus(item.id) !== 'HEALTHY') return false;
      const d = this.drivers.get(item.id);
      return d && d.status === 'AVAILABLE';
    });

    if (candidates && candidates.length > 0) {
      const match = candidates[0];
      const dinfo = this.drivers.get(match.id);
      if (dinfo) return { ...dinfo };
    }

    // 2. Fallback: Linear scan if R-Tree has no candidate
    let bestDriver = null;
    let minDistance = Infinity;

    for (const [driverId, dinfo] of this.drivers.entries()) {
      if (excludeIds.includes(driverId)) continue;
      if (this.faultMonitor.getNodeStatus(driverId) !== 'HEALTHY') continue;
      if (dinfo.status !== 'AVAILABLE') continue;

      const dist = Math.hypot(dinfo.x - pickup[0], dinfo.y - pickup[1]);
      if (dist < minDistance) {
        minDistance = dist;
        bestDriver = { ...dinfo };
      }
    }
    return bestDriver;
  }

  // ------------------ MOM Handlers ------------------

  _onDriverTelemetry(topic, payload) {
    const { driverId, x, y, status } = payload;
    if (!driverId) return;

    if (!this.drivers.has(driverId)) {
      this.drivers.set(driverId, { driverId, x, y, status, lastSeen: Date.now() });
    } else {
      const d = this.drivers.get(driverId);
      d.x = x;
      d.y = y;
      d.status = status;
      d.lastSeen = Date.now();
    }

    // Update R-Tree Geo-Spatial Index
    this.rTree.update(driverId, x, y, { driverId, status });
    this.faultMonitor.recordHeartbeat(driverId);
  }

  _onDriverHeartbeat(topic, payload) {
    const { driverId, status } = payload;
    if (!driverId) return;
    this.faultMonitor.recordHeartbeat(driverId, payload);
    if (this.drivers.has(driverId) && this.drivers.get(driverId).status === 'CRASHED') {
      this.drivers.get(driverId).status = status || 'AVAILABLE';
    }
  }

  _onTripCompleted(topic, payload) {
    const { rideId, driverId } = payload;
    if (this.activeRides.has(rideId)) {
      this.activeRides.get(rideId).status = 'COMPLETED';
    }
    this.driverToRide.delete(driverId);
    if (this.drivers.has(driverId)) {
      this.drivers.get(driverId).status = 'AVAILABLE';
    }

    const vClock = this.vectorClock.send();
    const lTs = this.lamportClock.send();

    this.brokerClient.publish('rides.status', {
      event: 'RIDE_COMPLETED',
      rideId,
      driverId,
      lamportTs: lTs,
      vectorClock: vClock
    });
  }

  stop() {
    this.rpcSkeleton.stop();
    this.faultMonitor.stop();
    this.brokerClient.close();
    this.brokerServer.stop();
  }
}

// Support CLI direct execution
if (require.main === module) {
  const coordinator = new CoordinatorNode();
  coordinator.start().then(() => {
    console.log('[Coordinator Process] Running independently. Press Ctrl+C to stop.');
  });
}

module.exports = {
  CoordinatorNode
};
