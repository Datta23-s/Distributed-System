

const { CoordinatorNode } = require('./nodes/coordinator');
const { DriverNode } = require('./nodes/driver');
const { CustomerNode } = require('./nodes/customer');

async function main() {
  console.log('=================================================================');
  console.log('🌐 URBANPULSE - DISTRIBUTED RIDE-SHARING SIMULATOR (FA-1)');
  console.log('   All Concepts from Unit 1 & Unit 2 Implemented');
  console.log('=================================================================\n');

  // 1. Launch Coordinator Node (RPC: 9000, MOM: 9100)
  console.log('1️⃣  Starting Coordinator Node (RPC Server Skeleton & MOM Broker)...');
  const coordinator = new CoordinatorNode('127.0.0.1', 9000, 9100);
  await coordinator.start(true);
  global.coordinatorInstance = coordinator;

  // 2. Launch Driver 1 Node
  console.log('2️⃣  Starting Driver 1 Node (P2P UDP 9021, Grid [20, 30])...');
  const driver1 = new DriverNode('driver-1', 9021, 20, 30, [9022, 9023]);
  await driver1.start();

  // 3. Launch Driver 2 Node
  console.log('3️⃣  Starting Driver 2 Node (P2P UDP 9022, Grid [50, 60])...');
  const driver2 = new DriverNode('driver-2', 9022, 50, 60, [9021, 9023]);
  await driver2.start();

  // 4. Launch Driver 3 Node
  console.log('4️⃣  Starting Driver 3 Node (P2P UDP 9023, Grid [80, 40])...');
  const driver3 = new DriverNode('driver-3', 9023, 80, 40, [9021, 9022]);
  await driver3.start();

  global.activeDrivers = {
    'driver-1': driver1,
    'driver-2': driver2,
    'driver-3': driver3
  };

  // 5. Launch Customer Node
  console.log('5️⃣  Starting Customer Node...');
  const customer = new CustomerNode('cust-demo');
  customer.start();
  global.customerInstance = customer;

  // 6. Launch Express Gateway & React UI Dashboard
  console.log('6️⃣  Starting Express Gateway & React Frontend...');
  require('./server');

  console.log('\n✨ All Distributed Nodes are up and communicating!');
  console.log('👉 Open your browser at: http://localhost:5000\n');
}

main().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
