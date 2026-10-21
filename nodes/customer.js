

const net = require('net');
const { ServiceRegistry, generateId } = require('../middleware/naming');
const { RPCClientStub } = require('../middleware/rpc');
const { MessageBrokerClient } = require('../middleware/broker');
const { LamportClock } = require('../middleware/lamport');
const { VectorClock } = require('../middleware/vectorClock');

class CustomerNode {
  constructor(customerId = null, coordinatorHost = '127.0.0.1', coordinatorRpcPort = 9000, brokerPort = 9100) {
    this.customerId = customerId || generateId('cust');
    this.coordinatorHost = coordinatorHost;
    this.coordinatorRpcPort = coordinatorRpcPort;
    this.brokerPort = brokerPort;

    // Unit 3: Synchronization - Logical Time
    this.lamportClock = new LamportClock('customer');
    this.vectorClock = new VectorClock('customer');

    // Location Transparency via Service Registry
    this.registry = new ServiceRegistry();
    const coordInfo = this.registry.lookup('service://coordinator');
    if (coordInfo) {
      this.coordinatorHost = coordInfo.host;
      this.coordinatorRpcPort = coordInfo.port;
    }

    // Unit 2: RPC Client Stub with Lamport clock
    this.rpcStub = new RPCClientStub(this.coordinatorHost, this.coordinatorRpcPort, 5000, this.lamportClock);

    // Unit 2: MOM Client with Lamport clock
    this.broker = new MessageBrokerClient(this.coordinatorHost, this.brokerPort, this.lamportClock);

    this.currentRide = null;
    this.assignedDriverId = null;
    this.driverLocation = null;
  }

  start(controlPort = 9034) {
    this.broker.subscribe('rides.status', this._onRideStatusEvent.bind(this));
    this.broker.subscribe('driver.telemetry', this._onDriverTelemetry.bind(this));

    this.controlPort = controlPort;
    this.controlServer = net.createServer((socket) => {
      let buffer = '';
      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf-8');
        let idx;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (line) {
            try {
              const msg = JSON.parse(line);
              if (msg.type === 'MARKER') {
                console.log(`[Customer SNAPSHOT TCP] Received MARKER from '${msg.from}' for Snapshot '${msg.snapshotId}'`);
              }
            } catch (e) { }
          }
        }
      });
      socket.on('error', () => { });
    });

    this.controlServer.listen(this.controlPort, '127.0.0.1', () => {
      console.log(`[Customer] Control TCP Channel listening on 127.0.0.1:${this.controlPort}`);
    });
    this.controlServer.on('error', () => { });
  }

  stop() {
    if (this.controlServer) {
      this.controlServer.close();
      this.controlServer = null;
    }
  }

  async estimateFare(pickup, dropoff) {
    return this.rpcStub.call('estimate_fare', { pickup, dropoff });
  }

  async requestRide(pickup, dropoff) {
    const res = await this.rpcStub.call('request_ride', {
      customerId: this.customerId,
      pickup,
      dropoff
    });

    if (res.status === 'OK') {
      this.currentRide = {
        rideId: res.rideId,
        pickup,
        dropoff,
        status: 'DISPATCHED'
      };
      this.assignedDriverId = res.driverId;
      console.log(`[Customer ${this.customerId}] Booked ride '${res.rideId}'. Assigned Driver: ${res.driverId}`);
    }
    return res;
  }

  _onRideStatusEvent(topic, payload) {
    const { event, ride, rideId, crashedDriver, newDriver } = payload;
    const targetRideId = (ride && ride.rideId) || rideId;

    if (this.currentRide && this.currentRide.rideId === targetRideId) {
      if (event === 'RIDE_REASSIGNED_FAILOVER') {
        console.log(`\n[Customer ${this.customerId}] 🔄 TRANSPARENT FAILOVER: Driver '${crashedDriver}' crashed! Coordinator reassigned your ride to '${newDriver}'!`);
        this.assignedDriverId = newDriver;
      } else if (event === 'DRIVER_EN_ROUTE_PICKUP') {
        console.log(`[Customer ${this.customerId}] 🚕 Driver is en route to your pickup point!`);
      } else if (event === 'CUSTOMER_PICKED_UP') {
        console.log(`[Customer ${this.customerId}] 🚗 Picked up! Heading to destination.`);
      } else if (event === 'RIDE_COMPLETED') {
        console.log(`[Customer ${this.customerId}] 🏁 Arrived at destination! Trip complete.`);
        this.currentRide = null;
        this.assignedDriverId = null;
      }
    }
  }

  _onDriverTelemetry(topic, payload) {
    if (this.assignedDriverId && payload.driverId === this.assignedDriverId) {
      this.driverLocation = [payload.x, payload.y];
    }
  }

  stop() {
    this.broker.close();
  }
}

// CLI Execution support
if (require.main === module) {
  const customer = new CustomerNode();
  customer.start();
  console.log(`[Customer Process ${customer.customerId}] Active. Requesting sample ride in 2s...`);
  setTimeout(async () => {
    try {
      const fare = await customer.estimateFare([10, 10], [80, 80]);
      console.log('Fare Estimate:', fare);
      const booking = await customer.requestRide([10, 10], [80, 80]);
      console.log('Booking Result:', booking);
    } catch (e) {
      console.error('Customer Error:', e);
    }
  }, 2000);
}

module.exports = {
  CustomerNode
};
