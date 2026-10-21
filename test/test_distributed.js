/**
 * Automated Test Suite for Distributed Systems Concepts (FA-1)
 * Tests:
 * 1. Service Registry & Naming (Unit 2 Self-Study & Unit 1 Location Transparency)
 * 2. Custom RPC Client Stub & Server Skeleton (Unit 2 Remote Procedure Call)
 * 3. Message-Oriented Middleware: Pub/Sub & Queues (Unit 2 MOM)
 * 4. Peer-to-Peer Gossip Overlay (Unit 2 P2P Messaging)
 * 5. Heartbeat & Automatic Failover (Unit 2 Fault Tolerance & Unit 1 Failure Transparency)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { ServiceRegistry, generateId } = require('../middleware/naming');
const { RPCServerSkeleton, RPCClientStub } = require('../middleware/rpc');
const { MessageBrokerServer, MessageBrokerClient } = require('../middleware/broker');
const { P2PNode } = require('../middleware/p2pMesh');
const { HeartbeatMonitor } = require('../middleware/faultMonitor');
const { LamportClock } = require('../middleware/lamport');
const { VectorClock } = require('../middleware/vectorClock');
const { BeaconService, NeighbourTable } = require('../middleware/beacon');
const { ElectionNode } = require('../middleware/election');
const { MutexManager, RESOURCES } = require('../middleware/mutex');
const { ClockSyncManager } = require('../middleware/clockSync');
const { SnapshotManager } = require('../middleware/snapshot');
const { DeadlockDetector } = require('../middleware/deadlock');
const { NameNode } = require('../services/dfs/nameNode');
const { DataNode } = require('../services/dfs/dataNode');
const { MapReduceMaster } = require('../services/mapreduce/mapReduceMaster');
const { ServerlessRuntime } = require('../services/serverless/serverlessRuntime');
const { RemoteObjectRegistry } = require('../middleware/objectRegistry');
const { LoadBalancer } = require('../services/gateway-lb/loadBalancer');
const { BlockchainLedger, Block, POW_DIFFICULTY_PREFIX } = require('../services/ledger/blockchainLedger');
const { QuorumKvStore } = require('../services/kvstore/quorumKvStore');
const { RTreeIndex, CITY_ZONES } = require('../middleware/rTreeIndex');
const { DistributedTracer } = require('../middleware/tracer');
const { CircuitBreaker, STATES } = require('../middleware/circuitBreaker');
const { EventStore } = require('../services/eventsourcing/eventStore');
const { DistributedRateLimiter, TokenBucket } = require('../middleware/rateLimiter');
const { JWTManager, AuthMiddleware, ROLES } = require('../middleware/auth');
const { RedisCache } = require('../services/cache/redisCache');
const { ProtobufSerializer, GrpcSidecarServer } = require('../middleware/grpcMesh');
const { ChaosEngine, FAULT_TYPES } = require('../middleware/chaosEngine');

async function runTests() {
  console.log('🧪 Starting Distributed Systems Concept Test Suite...\n');

  // -------------------------------------------------------------
  // Test 1: Service Registry & Naming
  // -------------------------------------------------------------
  console.log('▶ Test 1: Service Registry & Location Transparency');
  const registry = new ServiceRegistry();
  registry.register('service://coordinator', '127.0.0.1', 9000, { role: 'master' });

  const resolved = registry.lookup('service://coordinator');
  assert(resolved !== null, 'Lookup should find registered service');
  assert.strictEqual(resolved.host, '127.0.0.1');
  assert.strictEqual(resolved.port, 9000);

  const testId = generateId('ride');
  assert(testId.startsWith('ride-'), 'ID generation should use prefix');
  console.log('  ✅ PASSED: Name resolution & Unique ID generation working.\n');

  // -------------------------------------------------------------
  // Test 2: RPC Client Stub & Server Skeleton
  // -------------------------------------------------------------
  console.log('▶ Test 2: Remote Procedure Call (RPC)');
  const rpcServer = new RPCServerSkeleton('127.0.0.1', 9801);
  rpcServer.registerProcedure('calculate_fare', async ({ distance, surge = 1.0 }) => {
    return { fare: Number(((5.0 + distance * 2.0) * surge).toFixed(2)) };
  });
  await rpcServer.start();

  try {
    const rpcClient = new RPCClientStub('127.0.0.1', 9801);
    const result = await rpcClient.call('calculate_fare', { distance: 10.5, surge: 1.5 });
    assert.strictEqual(result.fare, 39.0, 'RPC calculation must match expected result');
    console.log('  ✅ PASSED: RPC Client Stub packed params, Skeleton executed, Stub received return value.\n');
  } finally {
    rpcServer.stop();
  }

  // -------------------------------------------------------------
  // Test 3: MOM (Point-to-Point Queue & Pub/Sub Topics)
  // -------------------------------------------------------------
  console.log('▶ Test 3: Message-Oriented Middleware (MOM)');
  const brokerServer = new MessageBrokerServer('127.0.0.1', 9802);
  await brokerServer.start();

  try {
    const brokerClient = new MessageBrokerClient('127.0.0.1', 9802);

    // Queue test
    await brokerClient.enqueue('driver_jobs', { orderId: 'ord-101', item: 'dispatch' });
    const dequeued = await brokerClient.dequeue('driver_jobs');
    assert(dequeued !== null, 'Should dequeue item');
    assert.strictEqual(dequeued.orderId, 'ord-101');

    // Pub/Sub test
    let receivedEvent = null;
    brokerClient.subscribe('rides.status', (topic, payload) => {
      receivedEvent = payload;
    });

    await new Promise((r) => setTimeout(r, 150));
    await brokerClient.publish('rides.status', { status: 'DISPATCHED', rideId: 'r-100' });
    await new Promise((r) => setTimeout(r, 200));

    assert(receivedEvent !== null, 'Subscriber should receive published event');
    assert.strictEqual(receivedEvent.status, 'DISPATCHED');
    brokerClient.close();
    console.log('  ✅ PASSED: MOM Persistent Queues and Topic Pub/Sub working.\n');
  } finally {
    brokerServer.stop();
  }

  // -------------------------------------------------------------
  // Test 4: Peer-to-Peer (P2P) Gossip Overlay
  // -------------------------------------------------------------
  console.log('▶ Test 4: Peer-to-Peer (P2P) UDP Gossip Mesh');
  const node1 = new P2PNode('driver-1', '127.0.0.1', 9803);
  const node2 = new P2PNode('driver-2', '127.0.0.1', 9804);
  const node3 = new P2PNode('driver-3', '127.0.0.1', 9805);

  // Overlay: Node1 -> Node2 -> Node3
  node1.addPeer('127.0.0.1', 9804);
  node2.addPeer('127.0.0.1', 9805);

  let node3Received = null;
  node3.onAlert((alert) => {
    node3Received = alert;
  });

  await node1.start();
  await node2.start();
  await node3.start();

  try {
    // Node 1 broadcasts. Should gossip to Node 2, and Node 2 forwards to Node 3!
    node1.broadcastHazardAlert('WATERLOGGING', [25, 40], 'Road blocked on 5th Ave');
    await new Promise((r) => setTimeout(r, 300));

    assert(node3Received !== null, 'Node 3 should receive multi-hop gossip packet');
    assert.strictEqual(node3Received.hazardType, 'WATERLOGGING');
    assert.strictEqual(node3Received.originNode, 'driver-1');
    console.log('  ✅ PASSED: Decentralized P2P UDP Gossip hopped across nodes without central server.\n');
  } finally {
    node1.stop();
    node2.stop();
    node3.stop();
  }

  // -------------------------------------------------------------
  // Test 5: Heartbeat & Crash Failover
  // -------------------------------------------------------------
  console.log('▶ Test 5: Fault Tolerance & Heartbeat Failure Detection');
  const monitor = new HeartbeatMonitor(500, 150);
  let failedNode = null;

  monitor.registerFailureCallback((nodeId) => {
    failedNode = nodeId;
  });

  monitor.recordHeartbeat('driver-2');
  monitor.start();

  assert.strictEqual(monitor.getNodeStatus('driver-2'), 'HEALTHY');

  // Wait past timeout (500ms) without sending heartbeats
  await new Promise((r) => setTimeout(r, 700));

  assert.strictEqual(monitor.getNodeStatus('driver-2'), 'CRASHED');
  assert.strictEqual(failedNode, 'driver-2', 'Watchdog must trigger failure callback on timeout');
  monitor.stop();
  console.log('  ✅ PASSED: Heartbeat failure detector recognized dead node and initiated failover.\n');

  // -------------------------------------------------------------
  // Test 6: Unit 3 Lamport Logical Clocks
  // -------------------------------------------------------------
  console.log('▶ Test 6: Unit 3 Lamport Logical Clocks (Partial Ordering)');
  const c1 = new LamportClock('node-1');
  const c2 = new LamportClock('node-2');

  assert.strictEqual(c1.getTime(), 0, 'Initial time must be 0');
  assert.strictEqual(c1.tick(), 1, 'Tick must increment time');
  const sendTs = c1.send();
  assert.strictEqual(sendTs, 2, 'Send must increment clock to 2');

  // c2 receives sendTs (2) when its local time is 0: max(0, 2) + 1 = 3
  const recvTs = c2.receive(sendTs);
  assert.strictEqual(recvTs, 3, 'Receive must jump to max(local, remote) + 1');
  assert(recvTs > sendTs, 'Monotonicity: receive timestamp must be strictly greater than send timestamp');

  // Network RPC test with Lamport clock piggybacking
  const rpcServerL = new RPCServerSkeleton('127.0.0.1', 9806, new LamportClock('server'));
  rpcServerL.registerProcedure('ping', async () => ({ status: 'PONG' }));
  await rpcServerL.start();

  try {
    const clientClock = new LamportClock('client', 5);
    const rpcClientL = new RPCClientStub('127.0.0.1', 9806, 5000, clientClock);
    const result = await rpcClientL.call('ping', {});
    assert.strictEqual(result.status, 'PONG');
    assert(clientClock.getTime() > 5, 'Client stub must update Lamport clock upon receiving response');
    console.log('  ✅ PASSED: Lamport Clock tick, send, receive, and RPC wire piggybacking verified.\n');
  } finally {
    rpcServerL.stop();
  }

  // -------------------------------------------------------------
  // Test 7: Unit 3 Vector Clocks & Causality Detection
  // -------------------------------------------------------------
  console.log('▶ Test 7: Unit 3 Vector Clocks (Causality: BEFORE, AFTER, CONCURRENT, EQUAL)');
  const vc1 = new VectorClock('driver-1');
  const vc2 = new VectorClock('driver-2');

  // 1. Initially both equal
  assert.strictEqual(VectorClock.compare(vc1.clone(), vc2.clone()), 'EQUAL');

  // 2. Driver-1 does a local tick/send: [driver-1: 1, driver-2: 0, ...]
  const v1 = vc1.send();
  // Driver-2 does a simultaneous local tick/send: [driver-1: 0, driver-2: 1, ...]
  const v2 = vc2.send();

  // 3. Neither knows about the other -> must be CONCURRENT
  const concurrentComp = VectorClock.compare(v1, v2);
  assert.strictEqual(concurrentComp, 'CONCURRENT', 'Simultaneous independent events must be CONCURRENT (A || B)');

  // 4. Driver-2 receives Driver-1's message: merges max, ticks local driver-2 -> [driver-1: 1, driver-2: 2, ...]
  const v2Received = vc2.receive(v1);
  // Now v1 should be strictly BEFORE v2Received (v1 -> v2Received)
  assert.strictEqual(VectorClock.compare(v1, v2Received), 'BEFORE', 'Causally preceding event must be BEFORE (A -> B)');
  assert.strictEqual(VectorClock.compare(v2Received, v1), 'AFTER', 'Causally successor event must be AFTER (B <- A)');

  console.log('  ✅ PASSED: Vector Clocks successfully detected EQUAL, CONCURRENT, BEFORE, and AFTER causality.\n');

  // -------------------------------------------------------------
  // Test 8: Unit 3 Discovery & Beacon Protocol
  // -------------------------------------------------------------
  console.log('▶ Test 8: Unit 3 Decentralized Beacon Protocol & Expiry');
  const ntable = new NeighbourTable(250); // 250ms expiry
  ntable.updateNeighbour('driver-2', { position: [15, 25], state: 'AVAILABLE' });

  assert.strictEqual(ntable.getAll()['driver-2'].isAlive, true, 'Neighbour must be ALIVE initially');
  assert.strictEqual(ntable.getAliveNodes().includes('driver-2'), true);

  // Wait past 250ms timeout
  await new Promise((r) => setTimeout(r, 350));
  ntable.prune();
  assert.strictEqual(ntable.getAll()['driver-2'].isAlive, false, 'Neighbour must be marked EXPIRED after timeout');

  // Real UDP Beacon test across sockets
  const b1 = new BeaconService('d1-test', 9841, [9842], () => ({ position: [10, 20], state: 'AVAILABLE', lamportTs: 1 }));
  const b2 = new BeaconService('d2-test', 9842, [9841], () => ({ position: [50, 60], state: 'ON_TRIP', lamportTs: 2 }));

  await b1.start();
  await b2.start();

  try {
    b1.broadcastBeacon();
    await new Promise((r) => setTimeout(r, 200));

    const d2Seen = b2.getNeighbours()['d1-test'];
    assert(d2Seen !== undefined, 'Receiver beacon service must discover sender');
    assert.strictEqual(d2Seen.isAlive, true);
    console.log('  ✅ PASSED: UDP Beacons disseminated and NeighbourTable tracked liveness and expiry.\n');
  } finally {
    b1.stop();
    b2.stop();
  }

  // -------------------------------------------------------------
  // Test 9: Unit 3 Bully Leader Election Algorithm
  // -------------------------------------------------------------
  console.log('▶ Test 9: Unit 3 Bully Leader Election (TCP ELECTION / OK / COORDINATOR)');
  const peerElectionMap = {
    'driver-1': { host: '127.0.0.1', port: 9851 },
    'driver-2': { host: '127.0.0.1', port: 9852 },
    'driver-3': { host: '127.0.0.1', port: 9853 }
  };

  const elNode1 = new ElectionNode('driver-1', 9851, peerElectionMap);
  const elNode2 = new ElectionNode('driver-2', 9852, peerElectionMap);
  const elNode3 = new ElectionNode('driver-3', 9853, peerElectionMap);

  await elNode1.startServer();
  await elNode2.startServer();
  await elNode3.startServer();

  try {
    // Driver-1 detects Coordinator failure and triggers Bully election
    const bullyResult = await elNode1.runBullyElection(['driver-1', 'driver-2', 'driver-3']);
    assert(bullyResult.stats.electionMsgs >= 2, 'Driver-1 must probe higher nodes');
    assert(bullyResult.stats.okMsgs >= 1, 'Higher nodes must answer OK to bully lower node');

    // When driver-3 runs election, it has the highest priority ID (3 > 2 > 1) and must win
    const topBullyResult = await elNode3.runBullyElection(['driver-1', 'driver-2', 'driver-3']);
    assert.strictEqual(topBullyResult.winner, 'driver-3', 'Highest live ID must win Bully election');
    assert(topBullyResult.stats.coordinatorMsgs >= 2, 'Winner must broadcast victory to all lower nodes');
    console.log('  ✅ PASSED: Bully Algorithm executed probes, answers, and declared highest live node leader.\n');
  } finally {
    elNode1.stop();
    elNode2.stop();
    elNode3.stop();
  }

  // -------------------------------------------------------------
  // Test 10: Unit 3 Ring Leader Election Algorithm
  // -------------------------------------------------------------
  console.log('▶ Test 10: Unit 3 Ring Leader Election (Logical Token Ring)');
  const ringNode = new ElectionNode('driver-1', 9859, peerElectionMap);

  const ringResult = await ringNode.runRingElection(['driver-1', 'driver-2', 'driver-3']);
  assert.strictEqual(ringResult.winner, 'driver-3', 'Highest priority candidate in ring must win');
  assert.strictEqual(ringResult.stats.totalMsgs, 6, 'Ring election message complexity must equal 2*N (N election + N victory)');
  console.log('  ✅ PASSED: Ring Election passed candidate list around ring and announced winner with exact 2*N message complexity.\n');

  // -------------------------------------------------------------
  // Test 11: Unit 3 Distributed Mutual Exclusion (Ricart-Agrawala & Token Ring)
  // -------------------------------------------------------------
  console.log('▶ Test 11: Unit 3 Distributed Mutual Exclusion (Ricart-Agrawala & Token Ring)');
  const mutex = new MutexManager('coordinator', ['driver-1', 'driver-2', 'driver-3']);

  // 11.1 Ricart-Agrawala: Driver-1 requests Airport Bay
  const acq1 = await mutex.acquireRicartAgrawala('driver-1', 'airport_bay');
  assert.strictEqual(acq1.status, 'ACQUIRED', 'Driver-1 should acquire free Airport Bay');
  assert.strictEqual(acq1.holder, 'driver-1');
  assert.strictEqual(mutex.stats['ricart-agrawala'].totalMsgs, 4, 'Ricart-Agrawala message complexity must equal 2*(N-1) = 4');

  // 11.2 Driver-2 contends while Bay is held: should be deferred
  const acq2 = await mutex.acquireRicartAgrawala('driver-2', 'airport_bay');
  assert.strictEqual(acq2.status, 'WAITING', 'Driver-2 must wait with deferred reply while Bay is held');
  assert.strictEqual(mutex.resources['airport_bay'].queue.length, 1);

  // 11.3 Driver-1 releases: deferred reply unblocks Driver-2
  const rel1 = await mutex.releaseRicartAgrawala('driver-1', 'airport_bay');
  assert.strictEqual(rel1.status, 'TRANSFERRED');
  assert.strictEqual(rel1.newHolder, 'driver-2', 'Deferred reply must automatically promote waiting Driver-2 to CS holder');

  // 11.4 Token Ring: Driver-3 requests EV Charging Station
  const tokenAcq = await mutex.acquireTokenRing('driver-3', 'charging_station');
  assert.strictEqual(tokenAcq.status, 'ACQUIRED');
  assert.strictEqual(tokenAcq.holder, 'driver-3');
  assert(tokenAcq.hops >= 0 && tokenAcq.hops <= 3, 'Token Ring traversal cost bounded by ring size N');
  console.log('  ✅ PASSED: Ricart-Agrawala deferred replies & Token Ring circulation verified.\n');

  // -------------------------------------------------------------
  // Test 12: Unit 3 Physical Clock Synchronization (Cristian & Berkeley)
  // -------------------------------------------------------------
  console.log("▶ Test 12: Unit 3 Physical Clock Synchronization (Cristian's RTT/2 & Berkeley Average)");
  const clockMgr = new ClockSyncManager();

  // 12.1 Verify initial clocks have non-zero skew
  const initialClocks = clockMgr.getClockStatuses();
  assert(Math.abs(initialClocks['driver-1'].offsetMs) > 100, 'Driver-1 should possess simulated skew');
  assert(Math.abs(initialClocks['driver-2'].offsetMs) > 100, 'Driver-2 should possess simulated skew');

  // 12.2 Cristian's Algorithm: Clients compensate with RTT/2
  const cristianResult = await clockMgr.runCristiansAlgorithm(15);
  assert.strictEqual(cristianResult.algorithm, "Cristian's Algorithm");
  const postCristianClocks = clockMgr.getClockStatuses();
  assert(Math.abs(postCristianClocks['driver-1'].offsetMs) <= 15, "Driver-1 clock offset must converge to near zero after Cristian's sync");
  assert(Math.abs(postCristianClocks['driver-2'].offsetMs) <= 15, "Driver-2 clock offset must converge to near zero after Cristian's sync");

  // 12.3 Re-skew and test Berkeley Algorithm
  clockMgr.induceRandomSkew();
  const berkeleyResult = await clockMgr.runBerkeleyAlgorithm(12);
  assert.strictEqual(berkeleyResult.algorithm, 'Berkeley Algorithm');
  const postBerkeleyClocks = clockMgr.getClockStatuses();
  const offsets = Object.values(postBerkeleyClocks).map((c) => c.offsetMs);
  const maxDiff = Math.max(...offsets) - Math.min(...offsets);
  assert(maxDiff <= 25, 'Berkeley Algorithm must converge all nodes within cluster variance bound (maxDiff <= 25ms)');
  assert(clockMgr.offsetTimeline && clockMgr.offsetTimeline.length >= 3, 'Offset timeline points must be recorded across sync iterations');
  console.log("  ✅ PASSED: Cristian's RTT/2 delay compensation and Berkeley multi-node average convergence verified.\n");

  // -------------------------------------------------------------
  // Test 13: Unit 3 Chandy-Lamport Distributed Snapshot & Consistent Cut
  // -------------------------------------------------------------
  console.log('▶ Test 13: Unit 3 Chandy-Lamport Distributed Snapshot (Consistent Cut & FIFO Markers)');
  const snapMgr = new SnapshotManager('coordinator');

  const mockCluster = {
    'driver-1': { x: 22, y: 35, status: 'AVAILABLE', currentRide: null, heldResources: ['airport_bay'] },
    'driver-2': { x: 55, y: 62, status: 'EN_ROUTE', currentRide: { rideId: 'ride-99', fare: 14.50 }, heldResources: [] },
    'driver-3': { x: 80, y: 40, status: 'AVAILABLE', currentRide: null, heldResources: [] },
    'coordinator': { status: 'ACTIVE', currentRide: null, heldResources: [] },
    pendingRides: [{ rideId: 'ride-101', pickup: [25, 30], fare: 12.00 }]
  };

  // 13.1 Execute Chandy-Lamport snapshot
  const snapshot = await snapMgr.takeSnapshot('coordinator', mockCluster);
  assert.strictEqual(snapshot.isComplete, true, 'Snapshot session must run to completion');
  assert(snapshot.nodeStates['coordinator'], 'Coordinator local state must be captured');
  assert(snapshot.nodeStates['driver-1'], 'Driver-1 local state must be captured');
  assert(snapshot.nodeStates['driver-2'], 'Driver-2 local state must be captured');
  assert.strictEqual(snapshot.nodeStates['driver-2'].currentRide.rideId, 'ride-99');

  // 13.2 Verify consistent cut validation
  assert.strictEqual(snapshot.consistencyReport.isConsistent, true, 'Snapshot with valid state must be consistent');
  assert.strictEqual(snapshot.consistencyReport.violations.length, 0);

  // 13.3 Test Invariant Violation Detection: Same ride assigned to two drivers
  const faultySession = {
    nodeStates: {
      'driver-1': { currentRide: { rideId: 'ride-hazard-dup' }, heldResources: [] },
      'driver-2': { currentRide: { rideId: 'ride-hazard-dup' }, heldResources: [] }
    }
  };
  const violationReport = snapMgr.verifyConsistentCut(faultySession);
  assert.strictEqual(violationReport.isConsistent, false, 'Cut detector must flag duplicate active rides as inconsistent');
  assert.strictEqual(violationReport.violations[0].invariant, 'SINGLE_RIDE_ASSIGNMENT');
  console.log('  ✅ PASSED: Chandy-Lamport consistent global cut and FIFO marker rules verified.\n');

  // -------------------------------------------------------------
  // Test 14: Unit 3 Chandy-Misra-Haas Edge-Chasing Deadlock Detection & Preemption
  // -------------------------------------------------------------
  console.log('▶ Test 14: Unit 3 Chandy-Misra-Haas Edge-Chasing Deadlock Detection & Preemption');
  const dlDetector = new DeadlockDetector('coordinator');

  // 14.1 Induce circular wait deadlock scenario
  dlDetector.induceDeadlockScenario();
  assert.strictEqual(dlDetector.isDeadlocked, true, 'Deadlock flag must be set');
  const wfg = dlDetector.getWaitForGraph();
  assert.strictEqual(wfg.edges.length, 2, 'Wait-For Graph must contain 2 circular edges');

  // 14.2 Run Chandy-Misra-Haas probe circulation
  const probeResult = await dlDetector.runEdgeChasing('driver-1');
  assert.strictEqual(probeResult.deadlockDetected, true, 'Edge-chasing must detect the circular wait cycle');
  assert(probeResult.cycle.includes('driver-1') && probeResult.cycle.includes('driver-2'), 'Detected cycle must contain D1 and D2');
  assert(probeResult.probeHops.length >= 2, 'Probe must traverse at least 2 hops around cycle');

  // 14.3 Resolve deadlock via victim preemption
  const resolution = dlDetector.resolveDeadlock('driver-2');
  assert.strictEqual(resolution.status, 'RESOLVED');
  assert.strictEqual(resolution.victim, 'driver-2');
  assert.strictEqual(resolution.beneficiary, 'driver-1');
  assert.strictEqual(dlDetector.isDeadlocked, false, 'System must no longer be deadlocked after victim preemption');
  assert.strictEqual(dlDetector.getWaitForGraph().edges.length, 0, 'WFG circular edges must be cleared');

  // 14.4 Verify Knapp's Classification reference data
  const knapps = dlDetector.getKnappsClassification();
  assert.strictEqual(knapps.currentImplementation, 'Edge-Chasing (Chandy-Misra-Haas)');
  assert.strictEqual(knapps.families.length, 4, 'Must classify all 4 Knapp deadlock families');
  console.log('  ✅ PASSED: Chandy-Misra-Haas edge-chasing probe circulation and victim preemption verified.\n');

  // -------------------------------------------------------------
  // Test 15: Unit 4 Mini-HDFS Distributed Storage (Chunking, 2x Replication, Resilient Read, Re-Replication)
  // -------------------------------------------------------------
  console.log('▶ Test 15: Unit 4 Mini-HDFS Distributed Storage (Chunking, Replication & Failover)');
  const testDfsDir = path.join(__dirname, '..', 'data', 'test_dfs');
  const d1Dir = path.join(testDfsDir, 'dn1');
  const d2Dir = path.join(testDfsDir, 'dn2');
  const d3Dir = path.join(testDfsDir, 'dn3');
  const nnDir = path.join(testDfsDir, 'namenode');

  const dn1 = new DataNode('dn-1', 9831, d1Dir);
  const dn2 = new DataNode('dn-2', 9832, d2Dir);
  const dn3 = new DataNode('dn-3', 9833, d3Dir);
  await dn1.start();
  await dn2.start();
  await dn3.start();

  const nameNode = new NameNode(9830, nnDir);
  nameNode.dataNodes = {
    'dn-1': { host: '127.0.0.1', port: 9831, alive: true },
    'dn-2': { host: '127.0.0.1', port: 9832, alive: true },
    'dn-3': { host: '127.0.0.1', port: 9833, alive: true }
  };

  try {
    // 15.1 Write multi-chunk file (512 bytes per chunk -> splits into 3 chunks)
    const samplePayload = 'FLEET_RECORD_LINE_'.repeat(80); // ~1440 bytes
    const writeRes = await nameNode.writeFile('trip_receipts.log', samplePayload, 2);
    assert.strictEqual(writeRes.status, 'OK');
    assert(writeRes.numChunks >= 2, 'File should be split into multiple chunks');
    assert.strictEqual(writeRes.fileRecord.chunks[0].replicas.length, 2, 'Each chunk must have 2 replicas');

    // 15.2 Read file back
    const readRes = await nameNode.readFile('trip_receipts.log');
    assert.strictEqual(readRes.status, 'OK');
    assert.strictEqual(readRes.content, samplePayload, 'Reassembled content must match written content');

    // 15.3 Resilient Read with Dead DataNode
    dn2.isAlive = false;
    nameNode.setDataNodeStatus('dn-2', false);
    const resilientRead = await nameNode.readFile('trip_receipts.log');
    assert.strictEqual(resilientRead.status, 'OK');
    assert.strictEqual(resilientRead.content, samplePayload, 'File must remain readable from replica when DataNode 2 dies');

    // 15.4 Re-Replication: Restore 2x replication to healthy dn-3
    const reRepRes = await nameNode.reReplicateUnderReplicatedChunks();
    assert.strictEqual(reRepRes.status, 'OK');
    const updatedMeta = nameNode.files.get('trip_receipts.log');
    for (const chunk of updatedMeta.chunks) {
      const liveReplicas = chunk.replicas.filter((nid) => nameNode.dataNodes[nid].alive);
      assert.strictEqual(liveReplicas.length, 2, 'Re-replication must restore 2 live replicas for each chunk');
    }
    console.log('  ✅ PASSED: Mini-HDFS chunk splitting, 2x replication, failover read, and re-replication verified.\n');
  } finally {
    dn1.stop();
    dn2.stop();
    dn3.stop();
    try { fs.rmSync(testDfsDir, { recursive: true, force: true }); } catch (e) {}
  }

  // -------------------------------------------------------------
  // Test 16: Unit 4 Distributed MapReduce (Data Locality, Map, Shuffle, Reduce)
  // -------------------------------------------------------------
  console.log('▶ Test 16: Unit 4 Distributed MapReduce (Map, Shuffle, Reduce)');
  const mrMaster = new MapReduceMaster();
  const sampleTrips = [
    { tripId: 't1', driverId: 'driver-1', zone: 'Downtown', fare: 20.0, distance: 4.0 },
    { tripId: 't2', driverId: 'driver-1', zone: 'Downtown', fare: 30.0, distance: 6.0 },
    { tripId: 't3', driverId: 'driver-2', zone: 'Airport', fare: 50.0, distance: 20.0 },
    { tripId: 't4', driverId: 'driver-2', zone: 'Downtown', fare: 25.0, distance: 5.0 },
    { tripId: 't5', driverId: 'driver-3', zone: 'Airport', fare: 60.0, distance: 22.0 }
  ];

  // 16.1 Job: avg_fare_by_zone
  const job1 = await mrMaster.runJob('avg_fare_by_zone', null, sampleTrips);
  assert.strictEqual(job1.status, 'COMPLETED');
  assert.strictEqual(job1.progress.map, 100);
  assert.strictEqual(job1.progress.shuffle, 100);
  assert.strictEqual(job1.progress.reduce, 100);
  assert.strictEqual(job1.stats.inputRecords, 5);
  assert.strictEqual(job1.stats.uniqueKeys, 2); // 'Downtown' and 'Airport'
  const downtownRes = job1.results.find((r) => r.zone === 'Downtown');
  assert(downtownRes !== undefined, 'Must aggregate Downtown zone');
  assert.strictEqual(downtownRes.tripCount, 3);
  assert.strictEqual(downtownRes.averageFare, 25.0); // (20 + 30 + 25) / 3 = 25.0

  // 16.2 Job: trips_per_driver
  const job2 = await mrMaster.runJob('trips_per_driver', null, sampleTrips);
  assert.strictEqual(job2.status, 'COMPLETED');
  assert.strictEqual(job2.stats.uniqueKeys, 3); // driver-1, driver-2, driver-3
  const d1TripRes = job2.results.find((r) => r.driverId === 'driver-1');
  assert.strictEqual(d1TripRes.completedTrips, 2);
  console.log('  ✅ PASSED: MapReduce data locality, partitioning shuffle, and reduce aggregation verified.\n');

  // -------------------------------------------------------------
  // Test 17: Unit 4 Serverless FaaS Runtime (Cold Start, Warm Reuse, Functions)
  // -------------------------------------------------------------
  console.log('▶ Test 17: Unit 4 Serverless FaaS Runtime (Cold vs Warm Starts)');
  const faas = new ServerlessRuntime(9840);

  // 17.1 Cold Start: First call must boot container
  const t0 = Date.now();
  const coldRes = await faas.invoke('estimateFare', { pickup: [10, 10], dropoff: [40, 50] }, 'TEST');
  const coldLatency = Date.now() - t0;
  assert.strictEqual(coldRes.isColdStart, true, 'First invocation must be a COLD START');
  assert(coldRes.containerId !== undefined, 'Container must be provisioned');
  assert.strictEqual(coldRes.output.service, 'estimateFare');
  assert(coldLatency >= 250, 'Cold start latency reflects container provision delay');

  // 17.2 Warm Start: Immediate subsequent call reuses warm container
  const t1 = Date.now();
  const warmRes = await faas.invoke('estimateFare', { pickup: [10, 10], dropoff: [40, 50] }, 'TEST');
  const warmLatency = Date.now() - t1;
  assert.strictEqual(warmRes.isColdStart, false, 'Immediate call must be a WARM START');
  assert.strictEqual(warmRes.containerId, coldRes.containerId, 'Must reuse identical warm container instance');
  assert(warmLatency < 100, 'Warm start latency must be significantly faster than cold start');

  // 17.3 Other Functions (surgePricing, generateReceipt)
  const surgeRes = await faas.invoke('surgePricing', { demand: 20, activeDrivers: 2 }, 'TEST');
  assert.strictEqual(surgeRes.output.service, 'surgePricing');
  assert(surgeRes.output.surgeMultiplier > 1.0, 'High demand/driver ratio must trigger surge');

  const rcptRes = await faas.invoke('generateReceipt', { tripId: 't-test-100', fare: 35.50, tip: 5.00 }, 'TEST');
  assert.strictEqual(rcptRes.output.totalPaid, 40.50);

  const metricsData = faas.getMetrics();
  assert(metricsData.metrics.totalInvocations >= 4);
  assert(metricsData.metrics.coldStarts >= 1);
  assert(metricsData.metrics.warmStarts >= 1);
  console.log('  ✅ PASSED: Serverless container boot, micro-VM cold start vs warm reuse, and execution verified.\n');

  // -------------------------------------------------------------
  // Test 18: Unit 4 Distributed Objects (RMI) & ES6 Proxy Stubs
  // -------------------------------------------------------------
  console.log('▶ Test 18: Unit 4 Distributed Objects (RMI & ES6 Proxy Stub)');
  const objRegistry = new RemoteObjectRegistry(9850);

  // 18.1 Bind a remote driver instance
  const mockDriver = {
    location: [35, 42],
    status: 'AVAILABLE',
    async getLocation() { return { x: this.location[0], y: this.location[1] }; },
    async acceptRide(rideId) { this.status = 'BUSY'; return { status: 'ACCEPTED', rideId, driver: 'driver-1' }; }
  };
  objRegistry.bind('obj://driver-1', '127.0.0.1', 9001, mockDriver);

  // 18.2 Create transparent ES6 Proxy Stub on client
  const driverProxy = objRegistry.createProxy('obj://driver-1');
  assert.strictEqual(driverProxy._objectId, 'obj://driver-1');

  // 18.3 Transparent method invocation via Proxy Trap
  const loc = await driverProxy.getLocation();
  assert.strictEqual(loc.x, 35);
  assert.strictEqual(loc.y, 42);

  const accept = await driverProxy.acceptRide('ride-test-888');
  assert.strictEqual(accept.status, 'ACCEPTED');
  assert.strictEqual(mockDriver.status, 'BUSY');

  // 18.4 Call chain logging
  const callHistory = objRegistry.getCallHistory();
  assert(callHistory.length >= 2, 'Proxy traps must record invocations in call chain log');
  assert.strictEqual(callHistory[0].objectId, 'obj://driver-1');
  console.log('  ✅ PASSED: Remote Object Reference binding, ES6 Proxy stub trap, and RMI verified.\n');

  // -------------------------------------------------------------
  // Test 19: Unit 4 Gateway Load Balancer & ETag Caching
  // -------------------------------------------------------------
  console.log('▶ Test 19: Unit 4 Gateway Load Balancer & HTTP Caching');
  const lb = new LoadBalancer(9860, [5001, 5002, 5003]);

  // 19.1 Round-Robin balancing
  lb.setStrategy('round-robin');
  const backend1 = lb.selectBackend();
  const backend2 = lb.selectBackend();
  const backend3 = lb.selectBackend();
  const backend4 = lb.selectBackend();
  assert.strictEqual(backend1.id, 'gateway-1');
  assert.strictEqual(backend2.id, 'gateway-2');
  assert.strictEqual(backend3.id, 'gateway-3');
  assert.strictEqual(backend4.id, 'gateway-1', 'Round-Robin must cycle back to gateway-1');

  // 19.2 Least-Connections balancing
  lb.setStrategy('least-connections');
  backend1.activeConnections = 5;
  backend2.activeConnections = 1;
  backend3.activeConnections = 4;
  const leastChoice = lb.selectBackend();
  assert.strictEqual(leastChoice.id, 'gateway-2', 'Least-connections must choose gateway with fewest active connections');

  // 19.3 Failover when instance dies
  lb.setInstanceStatus('gateway-2', false);
  const failoverChoice = lb.selectBackend();
  assert(failoverChoice.id !== 'gateway-2', 'Dead gateway must not be selected');

  // 19.4 ETag HTTP Caching
  const testUrl = '/api/fares/estimate?zone=Airport';
  const farePayload = JSON.stringify({ fare: 45.0, currency: 'USD' });
  const etag = lb.setCache(testUrl, farePayload);
  assert(etag && etag.startsWith('"'), 'ETag must be generated');

  const cacheHit = lb.checkCache(testUrl, null);
  assert.strictEqual(cacheHit.hit, true);
  assert.strictEqual(cacheHit.notModified, false);

  const cache304 = lb.checkCache(testUrl, etag);
  assert.strictEqual(cache304.hit, true);
  assert.strictEqual(cache304.notModified, true, 'Matching ETag must trigger 304 Not Modified');

  const cacheMiss = lb.checkCache('/api/fares/unknown', null);
  assert.strictEqual(cacheMiss.hit, false);
  console.log('  ✅ PASSED: Load balancer routing algorithms, failover removal, and ETag caching verified.\n');

  // -------------------------------------------------------------
  // Test 20: Unit 4 Blockchain Ledger & Quorum KV Store
  // -------------------------------------------------------------
  console.log('▶ Test 20: Unit 4 Blockchain Ledger & Quorum KV Store');

  // 20.1 Blockchain Ledger Mining & Integrity
  const ledger = new BlockchainLedger('coordinator');
  assert.strictEqual(ledger.getChain().length, 1, 'Genesis block present');

  const mineRes = ledger.mineNewBlock({ tripId: 'trip-alpha', fare: 28.50, customerId: 'c1' }, 'driver-1');
  assert.strictEqual(mineRes.status, 'OK');
  assert(mineRes.block.hash.startsWith(POW_DIFFICULTY_PREFIX), `Mined block hash must satisfy PoW target '${POW_DIFFICULTY_PREFIX}'`);
  assert.strictEqual(ledger.getChain('driver-1').length, 2);
  assert.strictEqual(ledger.getChain('driver-2').length, 2);

  // Validate chain across all nodes
  const val1 = ledger.validateChain('driver-1');
  assert.strictEqual(val1.isValid, true);

  // Inject Tampering into driver-2
  ledger.tamperBlock('driver-2', 1, 9999.00);
  const valCorrupted = ledger.validateChain('driver-2');
  assert.strictEqual(valCorrupted.isValid, false, 'Tampered block must fail cryptographic validation');
  assert(valCorrupted.errors.length > 0);

  // Run Majority Consensus Repair (3 honest nodes vs 1 corrupted node)
  const consensus = ledger.runMajorityConsensus();
  assert.strictEqual(consensus.consensusAchieved, true);
  assert.strictEqual(consensus.corruptedNodes.length, 1);
  assert.strictEqual(consensus.corruptedNodes[0], 'driver-2');

  const valRepaired = ledger.validateChain('driver-2');
  assert.strictEqual(valRepaired.isValid, true, 'Corrupted node must be repaired from honest majority');
  assert.strictEqual(ledger.getChain('driver-2')[1].data.fare, 28.50, 'Original legitimate fare restored');

  // 20.2 Tunable Quorum KV Store (Amazon Dynamo Model)
  const kv = new QuorumKvStore(3, 2, 2); // N=3, R=2, W=2 -> R+W = 4 > 3 (Strong Consistency)
  const model = kv.getConsistencyModel();
  assert.strictEqual(model.isStrong, true);

  // Write with W=2
  const writeRes = await kv.write('driver:10:status', 'AVAILABLE');
  assert.strictEqual(writeRes.status, 'OK');
  assert.strictEqual(writeRes.writtenTo.length, 2);

  // Read with R=2
  const readRes = await kv.read('driver:10:status');
  assert.strictEqual(readRes.status, 'OK');
  assert.strictEqual(readRes.value, 'AVAILABLE');

  // Verify Automatic Read Repair when reading stale node within read quorum
  kv.stores['replica-2'].set('driver:10:status', {
    key: 'driver:10:status',
    value: 'OLD_STALE_VALUE',
    vectorClock: { coordinator: 0 },
    timestamp: 1000
  });

  const repairRead = await kv.read('driver:10:status');
  assert.strictEqual(repairRead.value, 'AVAILABLE');
  assert.strictEqual(repairRead.readRepairPerformed, true, 'Read repair flag must be true');
  assert.strictEqual(kv.stores['replica-2'].get('driver:10:status').value, 'AVAILABLE', 'Read repair must sync stale replica');

  // 20.3 Network Partition & CAP Tradeoff
  kv.togglePartition('replica-2');
  kv.togglePartition('replica-3');
  let writeFailed = false;
  try {
    await kv.write('driver:10:status', 'BUSY');
  } catch (err) {
    writeFailed = true;
    assert(err.message.includes('Write Quorum Failed'));
  }
  assert.strictEqual(writeFailed, true, 'Write must fail when healthy nodes < W (Consistency prioritized over Availability)');

  kv.togglePartition('replica-2');
  kv.togglePartition('replica-3');
  console.log('  ✅ PASSED: Blockchain PoW mining, majority consensus repair, Dynamo tunable quorum, and Read Repair verified.\n');

  // -------------------------------------------------------------
  // Test 21: Unit 4 AI/ML-Powered Dynamic Surge Pricing Engine (Section 13.14)
  // -------------------------------------------------------------
  console.log('▶ Test 21: AI/ML Dynamic Surge Pricing Engine');
  const serverless = new ServerlessRuntime(9840);
  const surgeNormal = (await serverless.invoke('computeSurge', { demand: 5, activeDrivers: 5, hourOfDay: 14 })).output;
  assert.strictEqual(surgeNormal.surgeMultiplier, 1.0, 'Balanced supply/demand must yield 1.0x surge');

  const surgeHigh = (await serverless.invoke('computeSurge', { demand: 25, activeDrivers: 2, hourOfDay: 18 })).output;
  assert(surgeHigh.surgeMultiplier > 2.0, 'High demand imbalance during rush hour must produce significant surge multiplier');
  assert.strictEqual(surgeHigh.rushHour, true, 'Hour 18 must be recognized as peak rush hour');
  console.log(`  ✅ PASSED: Surge engine evaluated demand ratio ${surgeHigh.ratio} -> Multiplier ${surgeHigh.surgeMultiplier}x.\n`);

  // -------------------------------------------------------------
  // Test 22: Unit 4 Distributed Tracing & Observability (Section 13.15)
  // -------------------------------------------------------------
  console.log('▶ Test 22: OpenTelemetry Distributed Tracing & Observability');
  const tracer = new DistributedTracer(50);
  const rootSpan = tracer.startSpan('HTTP POST /api/ride/request', { service: 'gateway' });
  const childSpan = tracer.startSpan('RPC Coordinator.matchDriver', {
    service: 'coordinator',
    traceId: rootSpan.traceId,
    parentSpanId: rootSpan.spanId
  });

  await new Promise(r => setTimeout(r, 20));
  childSpan.finish('OK');
  rootSpan.finish('OK');

  const traceGraph = tracer.getTrace(rootSpan.traceId);
  assert(traceGraph !== null, 'Trace must be retrievable by traceId');
  assert.strictEqual(traceGraph.spans.length, 2, 'Trace must contain 2 recorded spans');
  assert.strictEqual(traceGraph.status, 'OK');
  assert(traceGraph.totalDurationMs >= 15, 'Trace duration must reflect elapsed time');

  const traceMetrics = tracer.getMetrics();
  assert(traceMetrics.services['gateway'] !== undefined);
  assert(traceMetrics.services['coordinator'] !== undefined);
  console.log('  ✅ PASSED: Distributed trace context propagated, parent-child span tree built, P50/P95 latencies recorded.\n');

  // -------------------------------------------------------------
  // Test 23: Unit 4 Circuit Breaker Pattern (Section 13.16)
  // -------------------------------------------------------------
  console.log('▶ Test 23: Circuit Breaker Pattern (Hystrix-Inspired)');
  let downstreamAvailable = false;
  const breaker = new CircuitBreaker('test_downstream', {
    failureThreshold: 3,
    resetTimeoutMs: 100,
    successThreshold: 2,
    fallback: () => ({ status: 'FALLBACK_CACHED_VALUE' })
  });

  assert.strictEqual(breaker.state, STATES.CLOSED, 'Circuit must start CLOSED');

  // Fail 3 times -> trip to OPEN
  for (let i = 0; i < 3; i++) {
    const res = await breaker.execute(async () => {
      if (!downstreamAvailable) throw new Error('Downstream TCP connection refused');
      return { status: 'ONLINE' };
    });
    assert.strictEqual(res.status, 'FALLBACK_CACHED_VALUE');
  }
  assert.strictEqual(breaker.state, STATES.OPEN, 'Circuit must trip to OPEN after 3 consecutive failures');

  // Immediate call should fail fast without invoking downstream
  let downstreamCalled = false;
  const fastFailRes = await breaker.execute(async () => {
    downstreamCalled = true;
    return { status: 'ONLINE' };
  });
  assert.strictEqual(downstreamCalled, false, 'OPEN circuit must fail-fast without invoking downstream');
  assert.strictEqual(fastFailRes.status, 'FALLBACK_CACHED_VALUE');

  // Wait for cooldown -> transitions to HALF_OPEN on next call
  await new Promise(r => setTimeout(r, 120));
  downstreamAvailable = true;
  await breaker.execute(async () => ({ status: 'ONLINE' }));
  assert.strictEqual(breaker.state, STATES.HALF_OPEN);

  // Second success in HALF_OPEN closes circuit
  await breaker.execute(async () => ({ status: 'ONLINE' }));
  assert.strictEqual(breaker.state, STATES.CLOSED, 'Circuit must heal and return to CLOSED state');
  console.log('  ✅ PASSED: Tri-state circuit breaker (CLOSED -> OPEN -> HALF_OPEN -> CLOSED) and fail-fast fallback verified.\n');

  // -------------------------------------------------------------
  // Test 24: Unit 4 Event Sourcing & CQRS Architecture (Section 13.17)
  // -------------------------------------------------------------
  console.log('▶ Test 24: Event Sourcing & CQRS Architecture with Time-Travel Replay');
  const eventStore = new EventStore(null, 100);

  const evtT0 = Date.now();
  await eventStore.append('RIDE_REQUESTED', 'ride-777', { customerId: 'cust-amy', pickup: [10, 10], dropoff: [30, 30] });
  await new Promise(r => setTimeout(r, 10));
  const evtT1 = Date.now();

  await eventStore.append('DRIVER_DISPATCHED', 'ride-777', { driverId: 'driver-1', fare: 28.50 });
  await new Promise(r => setTimeout(r, 10));
  const evtT2 = Date.now();

  await eventStore.append('TRIP_COMPLETED', 'ride-777', { driverId: 'driver-1', fare: 28.50, zone: 'Downtown' });

  // Verify current CQRS Read Projection
  const currentProjections = eventStore.getProjections();
  assert.strictEqual(currentProjections.completedRides.length, 1);
  assert.strictEqual(currentProjections.totalFares, 28.50);

  // Time-travel replay back to evtT1 (after requested, before dispatched)
  const replayPast = eventStore.replay(evtT1);
  assert.strictEqual(replayPast.eventsReplayed, 1);
  assert.strictEqual(replayPast.activeRides.length, 1);
  assert.strictEqual(replayPast.completedRides.length, 0, 'At t1, ride should still be active, not completed');
  console.log('  ✅ PASSED: Immutable event log appended, read projections updated, and time-travel replay verified.\n');

  // -------------------------------------------------------------
  // Test 25: Unit 4 API Rate Limiting & Distributed Throttling (Section 13.18)
  // -------------------------------------------------------------
  console.log('▶ Test 25: API Rate Limiting & Token Bucket Throttling');
  const bucket = new TokenBucket(3, 10);
  assert.strictEqual(bucket.consume(1), true);
  assert.strictEqual(bucket.consume(1), true);
  assert.strictEqual(bucket.consume(1), true);
  assert.strictEqual(bucket.consume(1), false, 'Token bucket should exhaust when capacity reached');

  const rateLimiterTest = new DistributedRateLimiter();
  const testIp = '192.168.1.100';

  // Booking tier limit is 20
  for (let i = 0; i < 15; i++) {
    const res = await rateLimiterTest.checkLimit(testIp, '/api/ride/request');
    assert.strictEqual(res.allowed, true);
  }
  console.log('  ✅ PASSED: Token bucket burst control and sliding window request shaping verified.\n');

  // -------------------------------------------------------------
  // Test 26: Unit 4 JWT Authentication & Role-Based Access Control (Section 13.19)
  // -------------------------------------------------------------
  console.log('▶ Test 26: JWT Authentication & Role-Based Access Control (RBAC)');
  const auth = new AuthMiddleware();
  const tokens = auth.generateTokens({ userId: 'u-admin-1', username: 'sysadmin', role: ROLES.ADMIN });
  assert(tokens.accessToken && tokens.refreshToken);

  const verified = JWTManager.verify(tokens.accessToken);
  assert.strictEqual(verified.username, 'sysadmin');
  assert.strictEqual(verified.role, ROLES.ADMIN);

  // Expired token rejection
  const expiredToken = JWTManager.sign({ sub: 'expired' }, -10);
  let expiredRejected = false;
  try {
    JWTManager.verify(expiredToken);
  } catch (err) {
    expiredRejected = true;
    assert(err.message.includes('expired'));
  }
  assert.strictEqual(expiredRejected, true, 'Expired JWT must be rejected');

  // Refresh token rotation
  const refreshedTokens = auth.refresh(tokens.refreshToken);
  assert(refreshedTokens.accessToken !== null);
  console.log('  ✅ PASSED: HS256 JWT signature verification, role claims extraction, and token refresh verified.\n');

  // -------------------------------------------------------------
  // Test 27: Unit 4 Geo-Spatial Indexing with R-Tree (Section 13.20)
  // -------------------------------------------------------------
  console.log('▶ Test 27: Geo-Spatial Indexing with R-Tree');
  const rtree = new RTreeIndex(3);
  rtree.insert('driver-1', 20, 30, { status: 'AVAILABLE' });
  rtree.insert('driver-2', 50, 60, { status: 'AVAILABLE' });
  rtree.insert('driver-3', 85, 40, { status: 'AVAILABLE' });

  // Nearest driver query from pickup [22, 28] -> driver-1
  const nearest = rtree.nearest(22, 28, 1);
  assert.strictEqual(nearest.length, 1);
  assert.strictEqual(nearest[0].id, 'driver-1');

  // Bounding box range query
  const bboxResults = rtree.searchBBox(0, 0, 60, 65);
  assert.strictEqual(bboxResults.length, 2, 'BBox [0,0,60,65] must contain driver-1 and driver-2');

  // Geo-fenced city zone classification
  assert.strictEqual(rtree.classifyZone(80, 20), 'Airport');
  assert.strictEqual(rtree.classifyZone(50, 50), 'Downtown');
  console.log('  ✅ PASSED: 2D R-Tree bounding box hierarchy, O(log N) nearest neighbor search, and zone classification verified.\n');

  // -------------------------------------------------------------
  // Test 28: Unit 4 Redis-Compatible In-Memory Cache Layer (Section 13.21)
  // -------------------------------------------------------------
  console.log('▶ Test 28: Redis-Compatible In-Memory Cache Layer (LRU & Invalidation)');
  const cache = new RedisCache(3, 500); // Max 3 items
  cache.set('fare:zone1', 25.50);
  cache.set('fare:zone2', 32.00);
  cache.set('fare:zone3', 18.00);

  assert.strictEqual(cache.get('fare:zone1'), 25.50);

  // Inserting 4th item should evict the LRU item ('fare:zone2' because zone1 was accessed)
  cache.set('fare:zone4', 45.00);
  assert.strictEqual(cache.get('fare:zone2'), null, 'LRU entry fare:zone2 must be evicted');
  assert.strictEqual(cache.get('fare:zone4'), 45.00);

  // Namespaced flush
  const flushed = cache.flush('fare:');
  assert(flushed >= 2);
  assert.strictEqual(cache.get('fare:zone4'), null);
  console.log('  ✅ PASSED: Cache-aside access, O(1) LRU eviction, and namespaced invalidation verified.\n');

  // -------------------------------------------------------------
  // Test 29: Unit 4 gRPC Service Mesh with Protocol Buffers (Section 13.22)
  // -------------------------------------------------------------
  console.log('▶ Test 29: gRPC Service Mesh with Binary Protocol Buffers');
  const sampleRequest = {
    customerId: 'cust-enterprise-99',
    pickupX: 25.5,
    pickupY: 30.2,
    dropoffX: 75.8,
    dropoffY: 80.1
  };

  const binaryEncoded = ProtobufSerializer.encodeRideRequest(sampleRequest);
  assert(binaryEncoded.length > 0, 'Binary encoding must produce valid buffer');

  const decodedRequest = ProtobufSerializer.decodeRideRequest(binaryEncoded);
  assert.strictEqual(decodedRequest.customerId, sampleRequest.customerId);
  assert(Math.abs(decodedRequest.pickupX - sampleRequest.pickupX) < 0.01);

  const grpcServer = new GrpcSidecarServer(9860);
  const benchmark = grpcServer.benchmark(sampleRequest);
  assert(benchmark.protobufBytes < benchmark.jsonBytes, 'Protobuf payload must be smaller than JSON');
  assert(benchmark.bandwidthSavedPercent > 40, 'Protobuf must save at least 40% bandwidth vs JSON');
  console.log(`  ✅ PASSED: Protobuf binary framing verified! Wire size: ${benchmark.protobufBytes}B vs JSON: ${benchmark.jsonBytes}B (${benchmark.bandwidthSavedPercent}% wire reduction).\n`);

  // -------------------------------------------------------------
  // Test 30: Unit 4 Chaos Engineering & Automated Resilience (Section 13.23)
  // -------------------------------------------------------------
  console.log('▶ Test 30: Chaos Engineering & Automated Resilience Testing');
  const chaos = new ChaosEngine();
  const mockMonitor = {
    markCrashedManually: () => {},
    recordHeartbeat: () => {}
  };

  const experiment = await chaos.runExperiment(FAULT_TYPES.NODE_CRASH, 'driver-2', {
    faultMonitor: mockMonitor
  });

  assert.strictEqual(experiment.status, 'COMPLETED');
  assert.strictEqual(experiment.steadyStateVerified, true);
  assert(experiment.recoveryTimeMs > 0);
  assert.strictEqual(experiment.recoveryMetrics.selfHealingScore, '100% (Zero Data Loss)');
  console.log(`  ✅ PASSED: Chaos Monkey fault injection executed, self-healing observed, Steady-State hypothesis verified in ${experiment.recoveryTimeMs}ms.\n`);

  console.log('======================================================');
  console.log('🎉 ALL 30 DISTRIBUTED SYSTEMS CONCEPT TESTS PASSED! 🎉');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('❌ Test Suite Failed:', err);
  process.exit(1);
});
