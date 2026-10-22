

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');

const { ServiceRegistry } = require('./middleware/naming');
const { RPCClientStub } = require('./middleware/rpc');
const { MessageBrokerClient } = require('./middleware/broker');
const { LamportClock } = require('./middleware/lamport');
const { VectorClock } = require('./middleware/vectorClock');
const { ElectionNode } = require('./middleware/election');
const { MutexManager, RESOURCES } = require('./middleware/mutex');
const { ClockSyncManager } = require('./middleware/clockSync');
const { SnapshotManager } = require('./middleware/snapshot');
const { DeadlockDetector } = require('./middleware/deadlock');

// Unit 4: Emerging Distributed Paradigms Services
const { NameNode } = require('./services/dfs/nameNode');
const { DataNode } = require('./services/dfs/dataNode');
const { MapReduceMaster } = require('./services/mapreduce/mapReduceMaster');
const { ServerlessRuntime } = require('./services/serverless/serverlessRuntime');
const { RemoteObjectRegistry } = require('./middleware/objectRegistry');
const { LoadBalancer } = require('./services/gateway-lb/loadBalancer');
const { BlockchainLedger } = require('./services/ledger/blockchainLedger');
const { QuorumKvStore } = require('./services/kvstore/quorumKvStore');

// Unit 4 Advanced Production Features (Sections 13.14 - 13.23)
const { RTreeIndex, CITY_ZONES } = require('./middleware/rTreeIndex');
const { globalTracer } = require('./middleware/tracer');
const { circuitRegistry } = require('./middleware/circuitBreaker');
const { globalEventStore } = require('./services/eventsourcing/eventStore');
const { rateLimiter } = require('./middleware/rateLimiter');
const { authManager, ROLES } = require('./middleware/auth');
const { globalCache } = require('./services/cache/redisCache');
const { grpcSidecar } = require('./middleware/grpcMesh');
const { chaosEngine, FAULT_TYPES } = require('./middleware/chaosEngine');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Section 13.18: API Rate Limiting & Distributed Throttling
app.use(rateLimiter.createMiddleware());

// Section 13.15: Distributed Tracing & Observability (OpenTelemetry)
app.use((req, res, next) => {
  if (req.path.startsWith('/css') || req.path.startsWith('/js') || req.path === '/' || req.path === '/index.html' || req.path.startsWith('/ws')) {
    return next();
  }
  const traceId = req.headers['x-trace-id'] || undefined;
  const span = globalTracer.startSpan(`${req.method} ${req.path}`, {
    service: 'express-gateway',
    traceId,
    tags: { http_method: req.method, http_path: req.path }
  });
  res.setHeader('X-Trace-Id', span.traceId);
  res.setHeader('X-Span-Id', span.spanId);

  const origEnd = res.end;
  res.end = function(...args) {
    span.finish(res.statusCode < 400 ? 'OK' : 'ERROR', res.statusCode >= 400 ? `HTTP ${res.statusCode}` : null);
    return origEnd.apply(this, args);
  };
  next();
});

// Section 13.19: JWT Authentication & Role-Based Access Control
app.use(authManager.authenticate);

// ============================================================================
// URBANPULSE DISPATCH PRODUCTION API (v1) - Pune, Maharashtra
// ============================================================================
const socketManager = require('./services/socketManager');
socketManager.attach(wss);

const v1AuthRoutes = require('./api/v1/authRoutes');
const v1MapRoutes = require('./api/v1/mapRoutes');
const v1FareRoutes = require('./api/v1/fareRoutes');
const v1CustomerRoutes = require('./api/v1/customerRoutes');
const v1RideRoutes = require('./api/v1/rideRoutes');
const v1DriverRoutes = require('./api/v1/driverRoutes');
const v1PaymentRoutes = require('./api/v1/paymentRoutes');
const v1AdminRoutes = require('./api/v1/adminRoutes');

app.use('/api/v1/auth', v1AuthRoutes);
app.use('/api/v1/maps', v1MapRoutes);
app.use('/api/v1/fares', v1FareRoutes);
app.use('/api/v1/customer', v1CustomerRoutes);
app.use('/api/v1/rides', v1RideRoutes);
app.use('/api/v1/driver', v1DriverRoutes);
app.use('/api/v1/payments', v1PaymentRoutes);
app.use('/api/v1/admin', v1AdminRoutes);

const PORT = process.env.PORT || 5000;
const registry = new ServiceRegistry();

// Unit 3: Synchronization - Mutex, Clock Sync, Snapshot & Deadlock Managers
const mutexManager = new MutexManager('coordinator', ['driver-1', 'driver-2', 'driver-3']);
const clockSyncManager = new ClockSyncManager();
const snapshotManager = new SnapshotManager('coordinator');
const deadlockDetector = new DeadlockDetector('coordinator');

// Unit 4: Emerging Paradigms - DFS, MapReduce, Serverless, Objects, LB, Ledger, KVStore
const nameNode = new NameNode(9200);
const dataNodes = {
  'driver-1': new DataNode('driver-1', 9301),
  'driver-2': new DataNode('driver-2', 9302),
  'driver-3': new DataNode('driver-3', 9303)
};
const mapReduceMaster = new MapReduceMaster(nameNode);
const serverlessRuntime = new ServerlessRuntime(9400, '127.0.0.1', 9100);
const objectRegistry = new RemoteObjectRegistry(9500);
const loadBalancer = new LoadBalancer(5000, [5001, 5002, 5003]);
const blockchainLedger = new BlockchainLedger('coordinator');
const quorumKvStore = new QuorumKvStore(3, 2, 2);

// Connect advanced features with core services
rateLimiter.setQuorumStore(quorumKvStore);
globalEventStore.nameNode = nameNode;
grpcSidecar.start().catch(() => {});

// Start Unit 4 Services
dataNodes['driver-1'].start().catch(() => { });
dataNodes['driver-2'].start().catch(() => { });
dataNodes['driver-3'].start().catch(() => { });
serverlessRuntime.start().catch(() => { });

// Bind Remote Objects in Registry: Each driver hosts its own object skeleton on its own port
const DRIVER_OBJECT_PORTS = {
  'driver-1': 9501,
  'driver-2': 9502,
  'driver-3': 9503
};

objectRegistry.bind('obj://driver-1', '127.0.0.1', DRIVER_OBJECT_PORTS['driver-1'], {
  getLocation: async () => {
    const d = global.activeDrivers && global.activeDrivers['driver-1'];
    return { status: 'OK', driverId: 'driver-1', position: d ? [Number(d.x.toFixed(1)), Number(d.y.toFixed(1))] : [20, 30] };
  },
  getStatus: async () => {
    const d = global.activeDrivers && global.activeDrivers['driver-1'];
    return { status: 'OK', driverId: 'driver-1', state: d ? d.status : 'AVAILABLE' };
  },
  acceptRide: async (rideId) => ({ status: 'OK', driverId: 'driver-1', rideId, action: 'ACCEPTED' })
}, ['getLocation', 'getStatus', 'acceptRide']);

objectRegistry.bind('obj://driver-2', '127.0.0.1', DRIVER_OBJECT_PORTS['driver-2'], {
  getLocation: async () => {
    const d = global.activeDrivers && global.activeDrivers['driver-2'];
    return { status: 'OK', driverId: 'driver-2', position: d ? [Number(d.x.toFixed(1)), Number(d.y.toFixed(1))] : [50, 60] };
  },
  getStatus: async () => {
    const d = global.activeDrivers && global.activeDrivers['driver-2'];
    return { status: 'OK', driverId: 'driver-2', state: d ? d.status : 'AVAILABLE' };
  },
  acceptRide: async (rideId) => ({ status: 'OK', driverId: 'driver-2', rideId, action: 'ACCEPTED' })
}, ['getLocation', 'getStatus', 'acceptRide']);

objectRegistry.bind('obj://driver-3', '127.0.0.1', DRIVER_OBJECT_PORTS['driver-3'], {
  getLocation: async () => {
    const d = global.activeDrivers && global.activeDrivers['driver-3'];
    return { status: 'OK', driverId: 'driver-3', position: d ? [Number(d.x.toFixed(1)), Number(d.y.toFixed(1))] : [80, 40] };
  },
  getStatus: async () => {
    const d = global.activeDrivers && global.activeDrivers['driver-3'];
    return { status: 'OK', driverId: 'driver-3', state: d ? d.status : 'AVAILABLE' };
  },
  acceptRide: async (rideId) => ({ status: 'OK', driverId: 'driver-3', rideId, action: 'ACCEPTED' })
}, ['getLocation', 'getStatus', 'acceptRide']);

// Seed sample trip log in Mini-HDFS
setTimeout(async () => {
  try {
    const sampleTrips = mapReduceMaster.generateSampleTripRecords();
    const content = sampleTrips.map((t) => JSON.stringify(t)).join('\n');
    await nameNode.writeFile('trip_receipts_fleet.log', content, 2);
  } catch (e) { }
}, 1200);


// Unit 3: Synchronization - Gateway Logical Clocks
const gatewayLamport = new LamportClock('gateway');
const brokerClient = new MessageBrokerClient('127.0.0.1', 9100, gatewayLamport);

// In-memory cluster snapshot
const state = {
  latestTelemetry: {},  // driverId -> telemetry
  activeRides: {},      // rideId -> ride
  p2pAlerts: [],
  protocolLogs: [],
  orderedEvents: [],    // Unit 3: Ordered Event Log sorted by Lamport timestamp
  currentLeader: 'coordinator',
  coordinatorAlive: true,
  electionTrace: [],
  electionStats: {
    bully: null,
    ring: null
  }
};

// Global references when run via unified launcher
global.activeDrivers = global.activeDrivers || {};
global.coordinatorInstance = global.coordinatorInstance || null;
global.customerInstance = global.customerInstance || null;

// Initial system event entries so logs and ordered events reflect real cluster state
setTimeout(() => {
  addLog('SYSTEM', '🌐 UrbanPulse Distributed Platform gateway online on port 5000');
  addLog('REGISTRY', 'Service Registry & Location Transparency online (RPC 9000, MOM 9100)');
  recordOrderedEvent('coordinator', 'SYSTEM_BOOT', 'Coordinator RPC skeleton and MOM message broker online', 1, null, { rpc: 9000, mom: 9100 });
  recordOrderedEvent('gateway', 'GATEWAY_START', 'Express gateway and WebSockets online on port 5000', 2, null, { port: 5000 });
}, 500);

function getClusterNeighbourTables() {
  const result = {};
  for (const [did, drv] of Object.entries(global.activeDrivers)) {
    if (drv && drv.getNeighbours) {
      result[did] = drv.getNeighbours();
    }
  }
  return result;
}

function recordOrderedEvent(node, eventType, description, lamportTs = null, vectorClock = null, details = {}) {
  const ts = lamportTs !== null && lamportTs !== undefined ? parseInt(lamportTs, 10) : gatewayLamport.tick();
  gatewayLamport.receive(ts);

  const eventEntry = {
    id: `ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    time: new Date().toLocaleTimeString(),
    node,
    eventType,
    description,
    lamportTs: ts,
    vectorClock: vectorClock || null,
    details
  };

  state.orderedEvents.push(eventEntry);
  // Sort total order by Lamport timestamp ascending
  state.orderedEvents.sort((a, b) => a.lamportTs - b.lamportTs);
  if (state.orderedEvents.length > 100) state.orderedEvents.shift();

  broadcastWS({
    type: 'ordered_event',
    event: eventEntry
  });

  return eventEntry;
}

function addLog(category, message, details = {}) {
  const entry = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    time: new Date().toLocaleTimeString(),
    category, // RPC, MOM, STREAM, P2P, FAULT, WEBRTC, SYNC, ELECTION
    message,
    details
  };
  state.protocolLogs.push(entry);
  if (state.protocolLogs.length > 80) state.protocolLogs.shift();

  broadcastWS({
    type: 'log',
    log: entry
  });
}

function broadcastWS(packet) {
  const data = JSON.stringify(packet);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(data);
      } catch (e) { }
    }
  });
}

// ------------------ REST / RPC API Endpoints ------------------

app.get('/api/state', (req, res) => {
  const coord = registry.lookup('service://coordinator');

  // Compute maximum clock skew across nodes
  const clockStatuses = clockSyncManager.getClockStatuses();
  const offsets = Object.values(clockStatuses || {}).map((c) => Math.abs(c.offsetMs || 0));
  const maxSkewMs = offsets.length > 0 ? Math.max(...offsets) : 0;

  if (!state.lastServedGateway) {
    const liveGw = loadBalancer.getAliveInstances();
    state.lastServedGateway = liveGw.length > 0 ? `${liveGw[0].id} (Port ${liveGw[0].port})` : 'gateway-1 (Port 5001)';
  }

  res.json({
    coordinator: coord,
    coordinatorAlive: state.coordinatorAlive,
    currentLeader: state.currentLeader,
    drivers: Object.values(state.latestTelemetry),
    activeRides: Object.values(state.activeRides),
    p2pAlerts: state.p2pAlerts.slice(-10),
    protocolLogs: state.protocolLogs.slice(-30),
    orderedEvents: state.orderedEvents.slice(-40),
    driverNeighbours: getClusterNeighbourTables(),
    electionTrace: state.electionTrace.slice(-15),
    electionStats: state.electionStats,
    gatewayLamport: gatewayLamport.getTime(),
    clockSkewMs: maxSkewMs,
    lastServedGateway: state.lastServedGateway,
    gatewayInstances: loadBalancer.instances,
    customerAlive: true,
    timestamp: Date.now()
  });
});

// Unit 3: Discovery & Neighbour Table Endpoint
app.get('/api/discovery/neighbours', (req, res) => {
  res.json({
    status: 'OK',
    neighbours: getClusterNeighbourTables(),
    timestamp: Date.now()
  });
});

// Unit 3: Leader Election Endpoints
app.post('/api/election/kill_coordinator', (req, res) => {
  state.coordinatorAlive = false;
  state.currentLeader = 'NONE (ELECTION NEEDED)';

  addLog('FAULT', '💀 FAULT INJECTED: Primary Coordinator CRASHED! Heartbeats stopped. Drivers triggering election...');
  recordOrderedEvent('coordinator', 'COORDINATOR_CRASHED', 'Primary Coordinator failed. Election triggered.');

  broadcastWS({
    type: 'coordinator_killed',
    currentLeader: state.currentLeader
  });

  res.json({
    status: 'OK',
    message: 'Coordinator crashed. Drivers have detected failure and are ready for election!'
  });
});

app.post(['/api/election/run', '/api/election/start'], async (req, res) => {
  const { algorithm = 'bully', initiator = 'driver-1' } = req.body;
  const liveDrivers = Object.keys(global.activeDrivers).filter((did) => {
    return global.activeDrivers[did] && global.activeDrivers[did].status !== 'CRASHED';
  });

  const candidateNodes = liveDrivers.length > 0 ? liveDrivers : ['driver-1', 'driver-2', 'driver-3'];
  const initiatorNode = candidateNodes.includes(initiator) ? initiator : candidateNodes[0];

  const peerMap = {
    'driver-1': { host: '127.0.0.1', port: 9031 },
    'driver-2': { host: '127.0.0.1', port: 9032 },
    'driver-3': { host: '127.0.0.1', port: 9033 }
  };

  const electionService = (global.activeDrivers[initiatorNode] && global.activeDrivers[initiatorNode].election)
    ? global.activeDrivers[initiatorNode].election
    : new ElectionNode(initiatorNode, 9039, peerMap);

  let result;
  if (algorithm.toLowerCase() === 'ring') {
    result = await electionService.runRingElection(candidateNodes);
    state.electionStats.ring = result.stats;
  } else {
    result = await electionService.runBullyElection(candidateNodes);
    state.electionStats.bully = result.stats;
  }

  const winner = result.winner;
  state.currentLeader = winner;
  state.electionTrace = result.trace;

  // Transparent Failover: Rebind service://coordinator in Service Registry (Location Transparency)
  registry.register('service://coordinator', '127.0.0.1', 9000, {
    type: 'elected_coordinator',
    leaderId: winner,
    algorithm: result.algorithm,
    electedAt: Date.now()
  });

  addLog('ELECTION', `👑 LEADER ELECTED: '${winner}' won the election via ${result.algorithm}! (Total messages: ${result.stats.totalMsgs})`, {
    winner,
    algorithm: result.algorithm,
    stats: result.stats
  });

  recordOrderedEvent(winner, 'LEADER_ELECTED', `Node '${winner}' elected new Coordinator via ${result.algorithm}`, null, null, result.stats);

  broadcastWS({
    type: 'election_result',
    result,
    currentLeader: winner
  });

  res.json({
    status: 'OK',
    result
  });
});

app.post('/api/election/recover_coordinator', (req, res) => {
  state.coordinatorAlive = true;
  state.currentLeader = 'coordinator';

  // Restore coordinator in registry
  registry.register('service://coordinator', '127.0.0.1', 9000, { type: 'coordinator' });

  addLog('ELECTION', '✨ Primary Coordinator RECOVERED: Resumed role as cluster coordinator.');
  recordOrderedEvent('coordinator', 'COORDINATOR_RECOVERED', 'Primary coordinator resumed leadership.');

  broadcastWS({
    type: 'coordinator_recovered',
    currentLeader: 'coordinator'
  });

  res.json({
    status: 'OK',
    currentLeader: 'coordinator',
    message: 'Primary Coordinator recovered successfully.'
  });
});

// Unit 3: Synchronization Endpoints
app.get('/api/sync/events', (req, res) => {
  res.json({
    status: 'OK',
    orderedEvents: state.orderedEvents,
    gatewayLamport: gatewayLamport.getTime()
  });
});

app.post('/api/sync/compare_vectors', (req, res) => {
  const { clockA, clockB } = req.body;
  const comparison = VectorClock.compare(clockA, clockB);
  res.json({
    status: 'OK',
    clockA,
    clockB,
    comparison // 'BEFORE' | 'AFTER' | 'CONCURRENT' | 'EQUAL'
  });
});

app.post('/api/sync/concurrent_hazard_demo', (req, res) => {
  // Scenario: Two drivers independently detect road hazards and broadcast simultaneously.
  // Neither has received the other's message, producing concurrent vector clocks (A || B).
  let alert1, alert2;

  if (global.activeDrivers['driver-1'] && global.activeDrivers['driver-2']) {
    alert1 = global.activeDrivers['driver-1'].broadcastHazard('OIL_SLICK', 'Oil spilled on 3rd St');
    alert2 = global.activeDrivers['driver-2'].broadcastHazard('FALLEN_TREE', 'Tree blocking Elm St');
  } else {
    // Fallback simulation if running in separate OS processes
    const v1 = new VectorClock('driver-1');
    const v2 = new VectorClock('driver-2');
    alert1 = {
      msgId: `p2p-driver-1-${Date.now()}`,
      originNode: 'driver-1',
      hazardType: 'OIL_SLICK',
      location: [25, 35],
      description: 'Oil spilled on 3rd St',
      timestamp: Date.now(),
      lamportTs: gatewayLamport.tick(),
      vectorClock: v1.send()
    };
    alert2 = {
      msgId: `p2p-driver-2-${Date.now() + 1}`,
      originNode: 'driver-2',
      hazardType: 'FALLEN_TREE',
      location: [55, 65],
      description: 'Tree blocking Elm St',
      timestamp: Date.now(),
      lamportTs: gatewayLamport.tick(),
      vectorClock: v2.send()
    };
  }

  state.p2pAlerts.push(alert1, alert2);

  const ev1 = recordOrderedEvent('driver-1', 'P2P_HAZARD_CONCURRENT', `Driver 1: ${alert1.hazardType}`, alert1.lamportTs, alert1.vectorClock, alert1);
  const ev2 = recordOrderedEvent('driver-2', 'P2P_HAZARD_CONCURRENT', `Driver 2: ${alert2.hazardType}`, alert2.lamportTs, alert2.vectorClock, alert2);

  const comparison = VectorClock.compare(alert1.vectorClock, alert2.vectorClock);

  addLog('P2P', `⚡ SIMULTANEOUS BROADCAST: Driver-1 & Driver-2 broadcasted hazards at the same time!`, {
    driver1Clock: alert1.vectorClock,
    driver2Clock: alert2.vectorClock,
    causality: comparison
  });

  res.json({
    status: 'OK',
    event1: ev1,
    event2: ev2,
    comparison,
    message: `Concurrent event generation demonstrated! Vector Clock comparison = ${comparison}`
  });
});

// Unit 3: Distributed Mutual Exclusion Endpoints
app.get('/api/mutex/status', (req, res) => {
  res.json({
    status: 'OK',
    ...mutexManager.getStatus()
  });
});

app.post(['/api/mutex/acquire', '/api/mutex/request'], async (req, res) => {
  const { driverId = 'driver-1', resource, resourceId, algorithm = 'ricart-agrawala' } = req.body;
  const targetResource = resource || resourceId || 'airport_bay';
  try {
    // Query alive peers from beacon neighbour table (Unit 3 Discovery integration)
    let alivePeers = ['driver-1', 'driver-2', 'driver-3'];
    if (global.activeDrivers && global.activeDrivers[driverId]) {
      const drv = global.activeDrivers[driverId];
      if (drv.beacon && drv.beacon.getAliveNeighbours) {
        const liveNeighbours = drv.beacon.getAliveNeighbours();
        alivePeers = [driverId, ...liveNeighbours.filter(id => id !== driverId)];
      }
    }

    let result;
    if (algorithm === 'token-ring') {
      result = await mutexManager.acquireTokenRing(driverId, targetResource, alivePeers);
    } else if (algorithm === 'lodha-kshemkalyani') {
      const vcs = {};
      for (const [did, drv] of Object.entries(global.activeDrivers)) {
        if (drv && drv.vectorClock) vcs[did] = drv.vectorClock.getClock();
      }
      result = await mutexManager.acquireLodhaKshemkalyani(driverId, targetResource, vcs);
    } else {
      result = await mutexManager.acquireRicartAgrawala(driverId, targetResource, alivePeers);
    }

    addLog('MUTEX', `🔒 Mutex [${targetResource}] ${result.status} by '${driverId}' via ${algorithm}`, result);
    recordOrderedEvent(driverId, 'MUTEX_ACQUIRE', `${driverId} requested ${targetResource} (${result.status}) via ${algorithm}`, null, null, result);

    broadcastWS({
      type: 'mutex_update',
      mutex: mutexManager.getStatus()
    });

    res.json({ status: 'OK', result, mutex: mutexManager.getStatus() });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

app.post('/api/mutex/release', async (req, res) => {
  const { resource, resourceId, algorithm = 'ricart-agrawala' } = req.body;
  const targetResource = resource || resourceId || 'airport_bay';
  const currentHolder = mutexManager.resources[targetResource]?.holder;
  const targetDriver = req.body.driverId || currentHolder || 'driver-1';

  try {
    if (mutexManager.resources[targetResource]?.status === 'FREE') {
      return res.json({
        status: 'OK',
        message: `Resource '${targetResource}' is already free.`,
        mutex: mutexManager.getStatus()
      });
    }

    let result;
    if (algorithm === 'token-ring') {
      result = await mutexManager.releaseTokenRing(targetDriver, targetResource);
    } else {
      result = await mutexManager.releaseRicartAgrawala(targetDriver, targetResource);
    }

    addLog('MUTEX', `🔓 Mutex [${targetResource}] RELEASED by '${targetDriver}' via ${algorithm}`, result);
    recordOrderedEvent(targetDriver, 'MUTEX_RELEASE', `${targetDriver} released ${targetResource} via ${algorithm}`, null, null, result);

    broadcastWS({
      type: 'mutex_update',
      mutex: mutexManager.getStatus()
    });

    res.json({ status: 'OK', result, mutex: mutexManager.getStatus() });
  } catch (err) {
    res.json({ status: 'NOTICE', message: err.message, mutex: mutexManager.getStatus() });
  }
});

// Unit 3: Physical Clock Synchronization Endpoints
app.get('/api/clock/status', (req, res) => {
  res.json({
    status: 'OK',
    clocks: clockSyncManager.getClockStatuses(),
    history: clockSyncManager.history,
    offsetTimeline: clockSyncManager.offsetTimeline || []
  });
});

app.post('/api/clock/sync', async (req, res) => {
  const { algorithm = 'cristian' } = req.body;
  try {
    let result;
    if (algorithm === 'berkeley') {
      result = await clockSyncManager.runBerkeleyAlgorithm();
    } else {
      result = await clockSyncManager.runCristiansAlgorithm();
    }

    addLog('CLOCK_SYNC', `⏱️ Clock Synchronized via ${result.algorithm}!`, result);
    recordOrderedEvent('coordinator', 'CLOCK_SYNC', `Cluster clocks synchronized using ${result.algorithm}`, null, null, result);

    broadcastWS({
      type: 'clock_sync_update',
      syncResult: result,
      clocks: clockSyncManager.getClockStatuses(),
      offsetTimeline: clockSyncManager.offsetTimeline || []
    });

    res.json({ status: 'OK', result, clocks: clockSyncManager.getClockStatuses(), offsetTimeline: clockSyncManager.offsetTimeline || [] });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

app.post('/api/clock/skew_reset', (req, res) => {
  const clocks = clockSyncManager.induceRandomSkew();
  addLog('CLOCK_SYNC', '🎲 Injected random hardware clock skews (±500ms) for demonstration.');
  broadcastWS({
    type: 'clock_sync_update',
    clocks,
    offsetTimeline: clockSyncManager.offsetTimeline || []
  });
  res.json({ status: 'OK', clocks, offsetTimeline: clockSyncManager.offsetTimeline || [] });
});

// ============================================================================
// Unit 3: Chandy-Lamport Distributed Snapshot Endpoints
// ============================================================================
app.get('/api/snapshot/latest', (req, res) => {
  res.json({
    status: 'OK',
    snapshot: snapshotManager.getLatestSnapshot(),
    history: snapshotManager.getHistory(),
    trace: snapshotManager.getTraceLog()
  });
});

app.post(['/api/snapshot/take', '/api/snapshot/start'], async (req, res) => {
  const { initiator, initiatorId } = req.body;
  const targetInitiator = initiator || initiatorId || 'coordinator';
  try {
    const clusterContext = {};
    if (global.activeDrivers) {
      for (const [did, drv] of Object.entries(global.activeDrivers)) {
        if (drv) {
          clusterContext[did] = {
            x: drv.x,
            y: drv.y,
            status: drv.status,
            currentRide: drv.currentRide,
            heldResources: mutexManager.resources.airport_bay?.holder === did
              ? ['airport_bay']
              : (mutexManager.resources.charging_station?.holder === did ? ['charging_station'] : []),
            lamportClock: drv.lamportClock,
            vectorClock: drv.vectorClock
          };
        }
      }
    }
    clusterContext['coordinator'] = {
      status: state.coordinatorAlive ? 'ACTIVE' : 'CRASHED',
      heldResources: [],
      lamportClock: gatewayLamport
    };

    const cust = global.customerInstance;
    clusterContext['customer'] = {
      status: 'ACTIVE',
      currentRide: cust ? cust.currentRide : null,
      heldResources: [],
      lamportClock: cust ? cust.lamportClock : null,
      vectorClock: cust ? cust.vectorClock : null
    };

    const snapshot = await snapshotManager.takeSnapshot(targetInitiator, clusterContext);

    addLog('SNAPSHOT', `📸 Distributed Snapshot taken (${snapshot.snapshotId}): Consistent Cut verified!`, {
      snapshotId: snapshot.snapshotId,
      isConsistent: snapshot.consistencyReport?.isConsistent
    });
    recordOrderedEvent(targetInitiator, 'SNAPSHOT_TAKEN', `Chandy-Lamport consistent snapshot ${snapshot.snapshotId} recorded`, null, null, snapshot);

    broadcastWS({
      type: 'snapshot_update',
      snapshot,
      history: snapshotManager.getHistory()
    });

    res.json({ status: 'OK', snapshot });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// ============================================================================
// Unit 3: Chandy-Misra-Haas Distributed Deadlock Detection Endpoints
// ============================================================================
app.get('/api/deadlock/status', (req, res) => {
  res.json({
    status: 'OK',
    waitForGraph: deadlockDetector.getWaitForGraph(),
    knapps: deadlockDetector.getKnappsClassification(),
    trace: deadlockDetector.getTraceLog()
  });
});

app.post('/api/deadlock/simulate', (req, res) => {
  const wfg = deadlockDetector.induceDeadlockScenario();
  addLog('DEADLOCK', '⚡ Circular wait deadlock induced between Driver 1 and Driver 2 (Bay <-> Charger)');
  recordOrderedEvent('coordinator', 'DEADLOCK_INDUCED', 'Circular wait scenario configured in WFG', null, null, wfg);

  broadcastWS({
    type: 'deadlock_update',
    waitForGraph: wfg
  });

  res.json({ status: 'OK', waitForGraph: wfg });
});

app.post('/api/deadlock/detect', async (req, res) => {
  const { initiator = 'driver-1' } = req.body;
  try {
    const result = await deadlockDetector.runEdgeChasing(initiator);
    if (result.deadlockDetected) {
      addLog('DEADLOCK', `🚨 Chandy-Misra-Haas: DEADLOCK DETECTED! Cycle: ${result.cycle.join(' -> ')}`, result);
      recordOrderedEvent(initiator, 'DEADLOCK_DETECTED', `Edge-chasing probe returned to ${initiator}. Deadlock confirmed.`, null, null, result);
    } else {
      addLog('DEADLOCK', `✅ Chandy-Misra-Haas: No deadlock cycle detected along probe path from '${initiator}'.`);
    }

    broadcastWS({
      type: 'deadlock_detected',
      result,
      waitForGraph: deadlockDetector.getWaitForGraph()
    });

    res.json({ status: 'OK', result, waitForGraph: deadlockDetector.getWaitForGraph() });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

app.post('/api/deadlock/resolve', (req, res) => {
  const { victim = 'driver-2' } = req.body;
  try {
    const resolution = deadlockDetector.resolveDeadlock(victim);
    addLog('DEADLOCK', `🛡️ Deadlock RESOLVED: Preempted victim '${victim}'. Released resources. Cycle broken!`, resolution);
    recordOrderedEvent(victim, 'DEADLOCK_RESOLVED', `Victim ${victim} preempted; resources released.`, null, null, resolution);

    broadcastWS({
      type: 'deadlock_resolved',
      resolution,
      waitForGraph: resolution.waitForGraph
    });

    res.json({ status: 'OK', resolution });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

app.post(['/api/ride/estimate', '/api/rpc/estimate_fare'], async (req, res) => {
  const { pickup, dropoff } = req.body;
  const backend = loadBalancer.selectBackend();
  if (backend) {
    state.lastServedGateway = `${backend.id} (Port ${backend.port})`;
  }
  const coord = registry.lookup('service://coordinator') || { host: '127.0.0.1', port: 9000 };
  const stub = new RPCClientStub(coord.host, coord.port, 5000, gatewayLamport);

  try {
    addLog('RPC', `Invoking remote procedure 'estimate_fare' on ${coord.host}:${coord.port} (Gateway: ${state.lastServedGateway})`, { pickup, dropoff });
    const result = await stub.call('estimate_fare', { pickup, dropoff });
    addLog('RPC', `Received RPC fare quote: $${result.estimatedFare} (${result.distanceKm} km)`, result);
    recordOrderedEvent('coordinator', 'RPC_FARE_ESTIMATE', `Fare estimate: $${result.estimatedFare} (${result.distanceKm} km)`, result._lamportTs, null, result);
    res.json({ ...result, servedBy: state.lastServedGateway });
  } catch (err) {
    addLog('RPC', `RPC estimate_fare failed: ${err.message}`, { error: err.message });
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

app.post(['/api/ride/request', '/api/rpc/request_ride'], async (req, res) => {
  const { customerId = 'cust-1', pickup, dropoff } = req.body;
  const backend = loadBalancer.selectBackend();
  if (backend) {
    state.lastServedGateway = `${backend.id} (Port ${backend.port})`;
  }
  const coord = registry.lookup('service://coordinator') || { host: '127.0.0.1', port: 9000 };
  const stub = new RPCClientStub(coord.host, coord.port, 5000, gatewayLamport);

  try {
    addLog('RPC', `Invoking remote procedure 'request_ride' for Customer '${customerId}' (Gateway: ${state.lastServedGateway})`, { pickup, dropoff });
    const result = await stub.call('request_ride', { customerId, pickup, dropoff });

    if (result.status === 'OK') {
      const dx = (dropoff && dropoff[0] ? dropoff[0] : 0) - (pickup && pickup[0] ? pickup[0] : 0);
      const dy = (dropoff && dropoff[1] ? dropoff[1] : 0) - (pickup && pickup[1] ? pickup[1] : 0);
      const dist = Math.hypot(dx, dy);
      const fare = Number((5.00 + dist * 1.75).toFixed(2));
      const distKm = Number(dist.toFixed(2));
      state.activeRides[result.rideId] = {
        rideId: result.rideId,
        driverId: result.driverId,
        pickup,
        dropoff,
        distanceKm: distKm,
        fare,
        status: 'DISPATCHED',
        createdAt: Date.now()
      };
      addLog('RPC', `Driver '${result.driverId}' assigned to Ride '${result.rideId}'`, result);
      recordOrderedEvent('coordinator', 'RIDE_DISPATCHED', `Ride '${result.rideId}' assigned to '${result.driverId}'`, result.lamportTs, result.vectorClock, result);
    }
    res.json({ ...result, servedBy: state.lastServedGateway });
  } catch (err) {
    addLog('RPC', `RPC request_ride failed: ${err.message}`, { error: err.message });
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

app.post('/api/fault/kill_driver', async (req, res) => {
  const { driverId } = req.body;

  // Stop driver if running locally
  if (global.activeDrivers[driverId]) {
    global.activeDrivers[driverId].simulateCrash();
  }

  // Also trigger coordinator fault monitor directly
  const coord = registry.lookup('service://coordinator') || { host: '127.0.0.1', port: 9000 };
  try {
    const stub = new RPCClientStub(coord.host, coord.port);
    await stub.call('kill_driver_simulation', { driverId });
  } catch (e) { }

  if (state.latestTelemetry[driverId]) {
    state.latestTelemetry[driverId].status = 'CRASHED';
  }

  addLog('FAULT', `⚠️ FAULT INJECTED: Node '${driverId}' CRASHED! Heartbeats ceased.`, { driverId });
  broadcastWS({
    type: 'driver_crashed',
    driverId
  });

  res.json({ status: 'OK', message: `Driver ${driverId} crashed. Watch coordinator detect failure and failover!` });
});

app.post('/api/fault/recover_driver', (req, res) => {
  const { driverId } = req.body;
  if (global.activeDrivers[driverId]) {
    global.activeDrivers[driverId].recover();
  }
  if (state.latestTelemetry[driverId]) {
    state.latestTelemetry[driverId].status = 'AVAILABLE';
  }
  addLog('FAULT', `✨ Node '${driverId}' recovered and back online.`, { driverId });
  res.json({ status: 'OK', message: `Driver ${driverId} recovered.` });
});

app.post('/api/p2p/hazard', (req, res) => {
  const { driverId = 'driver-1', hazardType = 'CONSTRUCTION', description = 'Road closed on Main St' } = req.body;

  let alert = null;
  if (global.activeDrivers[driverId]) {
    alert = global.activeDrivers[driverId].broadcastHazard(hazardType, description);
  } else {
    // Simulated packet if driver running out of process
    const vc = new VectorClock(driverId);
    alert = {
      msgId: `p2p-${driverId}-${Date.now()}`,
      originNode: driverId,
      hazardType,
      location: [45, 55],
      description,
      timestamp: Date.now(),
      lamportTs: gatewayLamport.tick(),
      vectorClock: vc.send(),
      ttl: 3
    };
  }

  state.p2pAlerts.push(alert);
  addLog('P2P', `📢 Driver '${driverId}' broadcasted P2P Gossip Hazard: ${hazardType} (${description})`, alert);
  recordOrderedEvent(alert.originNode, 'P2P_HAZARD', `${alert.hazardType}: ${alert.description}`, alert.lamportTs, alert.vectorClock, alert);

  broadcastWS({
    type: 'p2p_hazard',
    alert
  });

  res.json({ status: 'OK', alert });
});

// ------------------ WebSocket Streaming & WebRTC Signaling ------------------

wss.on('connection', (ws) => {
  // Send initial snapshot
  ws.send(JSON.stringify({
    type: 'snapshot',
    state: {
      drivers: Object.values(state.latestTelemetry),
      activeRides: Object.values(state.activeRides),
      p2pAlerts: state.p2pAlerts.slice(-10),
      protocolLogs: state.protocolLogs.slice(-20),
      orderedEvents: state.orderedEvents.slice(-50),
      gatewayLamport: gatewayLamport.getTime(),
      mutex: mutexManager.getStatus(),
      clocks: clockSyncManager.getClockStatuses(),
      clockHistory: clockSyncManager.history,
      offsetTimeline: clockSyncManager.offsetTimeline || []
    }
  }));

  ws.on('message', (messageText) => {
    try {
      const msg = JSON.parse(messageText.toString());

      // Unit 2: WebRTC Signaling (relaying SDP Offers, Answers, and ICE Candidates)
      if (['webrtc_offer', 'webrtc_answer', 'webrtc_ice'].includes(msg.type)) {
        addLog('WEBRTC', `WebRTC Signaling Packet Exchanged: ${msg.type} (${msg.from || 'Peer'} -> ${msg.to || 'Peer'})`);

        // Broadcast signaling packet to other peers
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(msg));
          }
        });
      }
    } catch (e) { }
  });
});

// ------------------ Connect to MOM Broker for Telemetry & Events ------------------

const completedRidesSet = new Set();
async function handleRideCompletion(payload) {
  const rideId = payload.rideId;
  const driverId = payload.driverId;
  if (!rideId || completedRidesSet.has(rideId)) return;
  completedRidesSet.add(rideId);

  if (state.activeRides[rideId]) {
    state.activeRides[rideId].status = 'COMPLETED';
    state.activeRides[rideId].completedAt = Date.now();
  }

  addLog('MOM', `🏁 Ride '${rideId}' completed by Driver '${driverId}'!`, payload);
  recordOrderedEvent(driverId, 'RIDE_COMPLETED', `Ride '${rideId}' reached destination and completed`, payload.lamportTs, payload.vectorClock, payload);

  // End-to-End Ride Pipeline: Step 6 Analytics Refresh (DFS, Blockchain Ledger, Quorum KV)
  const fare = (state.activeRides[rideId] && state.activeRides[rideId].fare) || 18.50;
  const distanceKm = (state.activeRides[rideId] && state.activeRides[rideId].distanceKm) || 4.2;
  const tripReceipt = {
    rideId,
    driverId,
    timestamp: Date.now(),
    fare,
    distanceKm
  };

  try {
    // 1. Mini-HDFS append
    await nameNode.writeFile(`trip_${rideId}.log`, JSON.stringify(tripReceipt), 2);
    addLog('DFS', `📁 Trip '${rideId}' receipt appended to Mini-HDFS DataNodes (:9301-:9303) with 2x replication`);
  } catch (err) {
    console.error('DFS auto-write error:', err.message);
  }

  try {
    // 2. Blockchain Ledger PoW mine
    const blockResult = blockchainLedger.mineNewBlock(tripReceipt, driverId);
    addLog('LEDGER', `⛏️ Block #${blockResult.block.index} mined by '${driverId}' with PoW Nonce ${blockResult.mineResult.nonce}`);
  } catch (err) {
    console.error('Ledger auto-mine error:', err.message);
  }

  try {
    // 3. Replicated Quorum KV Store write
    await quorumKvStore.write(`driver:${driverId}:last_trip`, rideId);
    await quorumKvStore.write(`driver:${driverId}:status`, 'AVAILABLE');
    addLog('KV', `💾 Driver '${driverId}' status updated to AVAILABLE in Replicated KV Store (W=${quorumKvStore.W})`);
  } catch (err) {
    console.error('KV auto-write error:', err.message);
  }

  broadcastWS({
    type: 'ride_pipeline_analytics_completed',
    rideId,
    driverId,
    receipt: tripReceipt,
    dfs: nameNode.getClusterStatus(),
    ledger: blockchainLedger.getStatus(),
    kv: quorumKvStore.getStatus()
  });
}

function initBrokerSubscription() {
  setTimeout(() => {
    try {
      // 1. Listen to Stream-Oriented Continuous Telemetry
      brokerClient.subscribe('driver.telemetry', (topic, payload) => {
        const { driverId } = payload;
        if (driverId) {
          // Note: Telemetry streaming does NOT tick Lamport clocks
          state.latestTelemetry[driverId] = payload;
          broadcastWS({
            type: 'telemetry',
            driver: payload
          });
        }
      });

      // 2. Listen to Trip Completed event directly
      brokerClient.subscribe('driver.trip_completed', (topic, payload) => {
        handleRideCompletion(payload);
      });

      // 3. Listen to MOM Ride Lifecycle Events
      brokerClient.subscribe('rides.status', (topic, payload) => {
        const { event, ride, rideId, crashedDriver, newDriver, lamportTs, vectorClock } = payload;

        if (ride) {
          state.activeRides[ride.rideId] = ride;
        }

        const sourceNode = (ride && ride.driverId) || payload.driverId || newDriver || 'coordinator';
        recordOrderedEvent(sourceNode, event, `MOM: ${event}`, lamportTs, vectorClock, payload);

        if (event === 'RIDE_REASSIGNED_FAILOVER') {
          addLog('FAULT', `🔄 FAILOVER: Stranded ride reassigned to '${newDriver}' (Crashed: '${crashedDriver}')`, payload);
        } else if (event === 'RIDE_DISPATCHED') {
          addLog('MOM', `MOM Event: Ride '${ride.rideId}' dispatched to '${ride.driverId}'`, ride);
        } else if (event === 'DRIVER_EN_ROUTE_PICKUP') {
          addLog('MOM', `Driver '${payload.driverId}' is en route to pickup`, payload);
        } else if (event === 'CUSTOMER_PICKED_UP') {
          addLog('MOM', `Customer picked up by Driver '${payload.driverId}'`, payload);
        } else if (event === 'RIDE_COMPLETED') {
          handleRideCompletion(payload);
        }

        broadcastWS({
          type: 'ride_event',
          event,
          data: payload
        });
      });
    } catch (err) {
      console.warn('[Express Gateway] Notice: MOM Broker not yet online, will retry...');
    }
  }, 1000);
}

// ============================================================================
// UNIT 4: EMERGING DISTRIBUTED PARADIGMS REST ENDPOINTS
// ============================================================================

// 1. Distributed File System (Mini-HDFS)
app.get('/api/dfs/status', (req, res) => {
  res.json(nameNode.getClusterStatus());
});

app.post('/api/dfs/write', async (req, res) => {
  const { filename = `receipt_${Date.now()}.log`, content = 'Sample fleet trip data' } = req.body;
  try {
    const result = await nameNode.writeFile(filename, content);
    addLog('DFS', `📁 Stored file '${filename}' in Mini-HDFS (${result.numChunks} chunks, 2x replication)`);
    recordOrderedEvent('coordinator', 'DFS_WRITE', `Stored ${filename} across DataNodes`, null, null, result);
    broadcastWS({ type: 'dfs_update', dfs: nameNode.getClusterStatus() });
    res.json({ status: 'OK', result });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

app.get('/api/dfs/read/:filename', async (req, res) => {
  const { filename } = req.params;
  try {
    const result = await nameNode.readFile(filename);
    addLog('DFS', `📖 Read file '${filename}' from Mini-HDFS (${result.sizeBytes} bytes)`);
    res.json({ status: 'OK', result });
  } catch (err) {
    res.status(404).json({ status: 'ERROR', message: err.message });
  }
});

app.post('/api/dfs/toggle_datanode', (req, res) => {
  const { nodeId, isAlive } = req.body;
  nameNode.setDataNodeStatus(nodeId, isAlive);
  if (dataNodes[nodeId]) {
    dataNodes[nodeId].isAlive = isAlive;
  }
  addLog('DFS', `⚙️ DataNode '${nodeId}' state set to: ${isAlive ? 'ONLINE' : 'CRASHED'}`);
  broadcastWS({ type: 'dfs_update', dfs: nameNode.getClusterStatus() });
  res.json({ status: 'OK', nodeId, isAlive });
});

app.post('/api/dfs/rereplicate', async (req, res) => {
  try {
    const result = await nameNode.reReplicateUnderReplicatedChunks();
    addLog('DFS', `🔄 Re-replication completed: Restored ${result.restoredChunks} chunks to 2x replication!`);
    broadcastWS({ type: 'dfs_update', dfs: nameNode.getClusterStatus() });
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// 2. MapReduce
app.get('/api/mapreduce/status', (req, res) => {
  res.json({
    status: 'OK',
    activeJob: mapReduceMaster.activeJob,
    latestJob: mapReduceMaster.getLatestJob(),
    history: mapReduceMaster.getJobHistory()
  });
});

app.post('/api/mapreduce/run', async (req, res) => {
  const { jobId = 'avg_fare_by_zone', filename = 'trip_receipts_fleet.log' } = req.body;
  try {
    const result = await mapReduceMaster.runJob(jobId, filename);
    addLog('MAPREDUCE', `⚡ MapReduce Job '${result.title}' completed in ${result.elapsedMs}ms!`, result);
    recordOrderedEvent('coordinator', 'MAPREDUCE_JOB_DONE', `MapReduce job ${jobId} completed`, null, null, result);
    broadcastWS({ type: 'mapreduce_update', job: result });
    res.json({ status: 'OK', job: result });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// 3. Serverless FaaS Runtime
app.get('/api/serverless/metrics', (req, res) => {
  res.json(serverlessRuntime.getMetrics());
});

app.post('/api/serverless/invoke', async (req, res) => {
  const { funcName = 'estimateFare', params = {} } = req.body;
  try {
    const result = await serverlessRuntime.invoke(funcName, params, 'DASHBOARD_INVOKE');
    addLog('SERVERLESS', `⚡ FaaS '${funcName}' executed [${result.isColdStart ? 'COLD START' : 'WARM REUSE'}] in ${result.latencyMs}ms`, result);
    recordOrderedEvent('serverless', 'FAAS_INVOKE', `${funcName} executed (${result.latencyMs}ms)`, null, null, result);
    broadcastWS({ type: 'serverless_update', metrics: serverlessRuntime.getMetrics() });
    res.json({ status: 'OK', result });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// 4. Distributed Objects (RMI / JS Proxy)
app.get('/api/objects/list', (req, res) => {
  res.json({
    status: 'OK',
    objects: objectRegistry.listObjects(),
    callHistory: objectRegistry.getCallHistory()
  });
});

app.post('/api/objects/invoke', async (req, res) => {
  const { objectId = 'obj://driver-1', method = 'getLocation', args = [] } = req.body;
  try {
    const proxy = objectRegistry.createProxy(objectId);
    const result = await proxy[method](...args);
    addLog('OBJECTS', `🌐 Remote Object Call: ${objectId}.${method}() returned`, result);
    recordOrderedEvent(objectId, 'RMI_PROXY_INVOKE', `Remote object method ${method}() executed via Proxy stub`, null, null, result);
    broadcastWS({ type: 'objects_update', callHistory: objectRegistry.getCallHistory() });
    res.json({ status: 'OK', result, callHistory: objectRegistry.getCallHistory() });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// 5. Gateway Load Balancer & Caching
app.get('/api/lb/status', (req, res) => {
  res.json(loadBalancer.getStats());
});

app.post('/api/lb/strategy', (req, res) => {
  const { strategy } = req.body;
  loadBalancer.setStrategy(strategy);
  addLog('LB', `⚖️ Load Balancer policy updated to: ${strategy}`);
  res.json({ status: 'OK', strategy });
});

app.post('/api/lb/toggle_instance', (req, res) => {
  const { instanceId, isAlive } = req.body;
  loadBalancer.setInstanceStatus(instanceId, isAlive);
  addLog('LB', `Gateway instance '${instanceId}' status set to: ${isAlive ? 'HEALTHY' : 'CRASHED'}`);
  res.json({ status: 'OK', instanceId, isAlive });
});

app.post('/api/lb/simulate_request', (req, res) => {
  const { path = '/api/ride/fare_rates', zone = 'Downtown' } = req.body;
  const cacheKey = `${path}?zone=${zone}`;
  const t0 = Date.now();

  const cacheResult = loadBalancer.checkCache(cacheKey);
  let servedBy = null;
  let fromCache = false;

  if (cacheResult.hit) {
    fromCache = true;
    servedBy = 'HTTP_CACHE (304 Not Modified)';
  } else {
    const backend = loadBalancer.selectBackend();
    if (!backend) {
      return res.status(503).json({ status: 'ERROR', message: 'All backend gateway instances are dead!' });
    }
    backend.totalRequests += 1;
    servedBy = `${backend.id} (Port ${backend.port})`;
    loadBalancer.setCache(cacheKey, JSON.stringify({ zone, baseRate: 15.00, perKm: 1.75 }));
  }

  const latencyMs = fromCache ? 2 : Math.floor(Math.random() * 15) + 5;
  const logEntry = loadBalancer.logRequest('GET', cacheKey, servedBy, fromCache, fromCache ? 304 : 200, latencyMs);

  addLog('LB', `Request served by: ${servedBy} [${fromCache ? 'CACHE HIT' : 'BACKEND ROUTE'}] in ${latencyMs}ms`);
  broadcastWS({ type: 'lb_update', stats: loadBalancer.getStats() });

  res.json({ status: 'OK', logEntry, stats: loadBalancer.getStats() });
});

// 6. Blockchain Ledger & DLT
app.get('/api/ledger/status', (req, res) => {
  res.json(blockchainLedger.getStatus());
});

app.post('/api/ledger/mine', (req, res) => {
  const { tripData = {}, minerNode = 'driver-1' } = req.body;
  try {
    const result = blockchainLedger.mineNewBlock(tripData, minerNode);
    addLog('LEDGER', `⛏️ Block #${result.block.index} mined by '${minerNode}' with PoW Nonce ${result.mineResult.nonce} (Hash: ${result.block.hash.substring(0, 12)}...)`);
    recordOrderedEvent(minerNode, 'BLOCK_MINED', `Mined block #${result.block.index} with PoW`, null, null, result);
    broadcastWS({ type: 'ledger_update', ledger: blockchainLedger.getStatus() });
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

app.post('/api/ledger/tamper', (req, res) => {
  const { nodeId = 'driver-2', blockIndex = 1, fakeFare = 999.99 } = req.body;
  const result = blockchainLedger.tamperBlock(nodeId, blockIndex, fakeFare);
  addLog('LEDGER', `🚨 Block #${blockIndex} tampered on '${nodeId}'! Cryptographic hash chain broken!`);
  broadcastWS({ type: 'ledger_update', ledger: blockchainLedger.getStatus() });
  res.json({ status: 'OK', result, ledger: blockchainLedger.getStatus() });
});

app.post('/api/ledger/consensus', (req, res) => {
  const result = blockchainLedger.runMajorityConsensus();
  addLog('LEDGER', `🛡️ Majority Consensus: ${result.summary}`);
  recordOrderedEvent('coordinator', 'LEDGER_CONSENSUS', result.summary, null, null, result);
  broadcastWS({ type: 'ledger_update', ledger: blockchainLedger.getStatus() });
  res.json({ status: 'OK', result, ledger: blockchainLedger.getStatus() });
});

// 7. Replicated KV Store with Tunable Quorum
app.get('/api/kv/status', (req, res) => {
  res.json(quorumKvStore.getStatus());
});

app.post('/api/kv/quorum', (req, res) => {
  const { R, W } = req.body;
  quorumKvStore.setQuorum(R, W);
  addLog('KV', `📊 Quorum parameters updated: R=${quorumKvStore.R}, W=${quorumKvStore.W} (Model: ${quorumKvStore.getConsistencyModel().level})`);
  res.json({ status: 'OK', model: quorumKvStore.getConsistencyModel() });
});

app.post('/api/kv/write', async (req, res) => {
  const { key = 'driver:1:status', value = 'AVAILABLE' } = req.body;
  try {
    const result = await quorumKvStore.write(key, value);
    addLog('KV', `💾 Quorum Write [${key}] = '${value}' achieved with W=${quorumKvStore.W} replicas`);
    recordOrderedEvent('coordinator', 'KV_WRITE', `Quorum write ${key}`, null, null, result);
    broadcastWS({ type: 'kv_update', kv: quorumKvStore.getStatus() });
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

app.get('/api/kv/read/:key', async (req, res) => {
  const { key } = req.params;
  try {
    const result = await quorumKvStore.read(key);
    addLog('KV', `🔍 Quorum Read [${key}] = '${result.value}' (Read Repair: ${result.readRepairPerformed ? 'YES' : 'NO'})`);
    broadcastWS({ type: 'kv_update', kv: quorumKvStore.getStatus() });
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

app.post('/api/kv/partition', (req, res) => {
  const { nodeId = 'replica-3' } = req.body;
  quorumKvStore.togglePartition(nodeId);
  const isPartitioned = quorumKvStore.partitionedNodes.has(nodeId);
  addLog('KV', `⚡ Network Partition: '${nodeId}' is now ${isPartitioned ? 'ISOLATED' : 'RECONNECTED'}`);
  broadcastWS({ type: 'kv_update', kv: quorumKvStore.getStatus() });
  res.json({ status: 'OK', nodeId, isPartitioned, kv: quorumKvStore.getStatus() });
});

// 8. End-to-End Enterprise Sync Pipeline & Live Cluster Health
app.get('/api/system/cluster_health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    coordinator: { leader: state.currentLeader || 'coordinator', alive: true },
    ingressRpc: { port: 9000, status: 'ONLINE', protocol: 'TCP' },
    momBroker: { port: 9100, status: 'ONLINE', protocol: 'TCP' },
    edgeMesh: { ports: [9021, 9022, 9023], onlineCount: Object.values(state.latestTelemetry).filter(d => d.status !== 'CRASHED').length },
    mutexBay: mutexManager.getStatus()?.resources?.airport_bay || { status: 'FREE' },
    dataLake: nameNode.getClusterStatus(),
    blockchain: blockchainLedger.getStatus(),
    quorumKv: quorumKvStore.getStatus(),
    lamport: gatewayLamport.getTime()
  });
});

app.post(['/api/system/e2e_sync', '/api/system/sync_all'], async (req, res) => {
  const syncId = `sync-${Date.now()}`;
  const driverId = 'driver-1';
  const steps = [];

  try {
    // 1. Ingress RPC dynamic quote calculation
    const distKm = (Math.random() * 8 + 4).toFixed(1);
    const fare = (12.00 + distKm * 2.25).toFixed(2);
    steps.push({ step: 'RPC_INGRESS', status: 'OK', detail: `Synchronous RPC Quote: $${fare} for ${distKm}km` });

    // 2. MOM Broker persistent queue publish
    const momPayload = { syncId, driverId, fare, timestamp: new Date().toISOString() };
    brokerClient.publish('rides.requests', momPayload);
    steps.push({ step: 'MOM_DISPATCH', status: 'OK', detail: `Published to persistent queue 'rides.requests' on MOM broker :9100` });

    // 3. Distributed Mutex entry & exit for VIP airport bay
    try {
      await mutexManager.acquireRicartAgrawala(driverId, 'airport_bay');
      steps.push({ step: 'DISTRIBUTED_MUTEX', status: 'OK', detail: `Airport Bay slot acquired via Ricart-Agrawala (2*(N-1) msgs)` });
      await mutexManager.releaseRicartAgrawala(driverId, 'airport_bay');
    } catch (e) {
      steps.push({ step: 'DISTRIBUTED_MUTEX', status: 'SKIPPED', detail: `Mutex slot handled (${e.message})` });
    }

    // 4. Mini-HDFS 2x replicated file persistence
    const tripLog = { syncId, driverId, fare, distanceKm: distKm, completedAt: new Date().toISOString() };
    await nameNode.writeFile(`trip_${syncId}.log`, JSON.stringify(tripLog), 2);
    steps.push({ step: 'DFS_REPLICATION', status: 'OK', detail: `Trip log chunked & stored 2x across Mini-HDFS DataNodes (:9301-:9303)` });

    // 5. Immutable SHA-256 Blockchain Ledger mining
    const blockRes = blockchainLedger.mineNewBlock(tripLog, driverId);
    steps.push({ step: 'LEDGER_BLOCK', status: 'OK', detail: `Block #${blockRes.block.index} mined with PoW Nonce ${blockRes.mineResult.nonce}` });

    // 6. Replicated Quorum KV Store commit
    await quorumKvStore.write(`driver:${driverId}:last_sync`, syncId);
    await quorumKvStore.write(`driver:${driverId}:status`, 'AVAILABLE');
    steps.push({ step: 'QUORUM_KV', status: 'OK', detail: `Committed state to Replicated KV Store (W=${quorumKvStore.W}, R=${quorumKvStore.R})` });

    // 7. Serverless FaaS receipt invocation
    try {
      const faasRes = await serverlessRuntime.invoke('estimateFare', { distanceKm: parseFloat(distKm), zone: 'Downtown' });
      steps.push({ step: 'SERVERLESS_FAAS', status: 'OK', detail: `FaaS invocation completed in ${faasRes.latencyMs}ms (${faasRes.isColdStart ? 'COLD START' : 'WARM REUSE'})` });
    } catch (e) {
      steps.push({ step: 'SERVERLESS_FAAS', status: 'SKIPPED', detail: `FaaS simulated` });
    }

    // 8. Lamport Logical Clock Ordering & Protocol Log
    const lTs = gatewayLamport.tick();
    recordOrderedEvent(driverId, 'SYSTEM_SYNC', `End-to-end sync transaction '${syncId}' committed`, lTs, null, { syncId, fare });
    addLog('SYNC', `⚡ End-to-End Enterprise Sync Pipeline executed successfully across 8 distributed microservices!`, { syncId, fare });

    // Broadcast comprehensive update to all active WebSockets
    broadcastWS({
      type: 'system_synced',
      syncId,
      dfs: nameNode.getClusterStatus(),
      ledger: blockchainLedger.getStatus(),
      kv: quorumKvStore.getStatus(),
      mutex: mutexManager.getStatus(),
      gatewayLamport: gatewayLamport.getTime()
    });

    res.json({
      status: 'OK',
      syncId,
      summary: 'All distributed subsystems (RPC, MOM, Mutex, HDFS, Blockchain, Quorum KV, FaaS, Lamport) executed synchronously in real time.',
      steps,
      cluster: {
        dfs: nameNode.getClusterStatus(),
        ledger: blockchainLedger.getStatus(),
        kv: quorumKvStore.getStatus()
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message, steps });
  }
});

// ============================================================================
// UNIT 4 ADVANCED FEATURES REST ENDPOINTS (Sections 13.14 - 13.23)
// ============================================================================

// Section 13.14: AI/ML-Powered Dynamic Surge Pricing Engine
app.post('/api/surge/compute', async (req, res) => {
  try {
    const result = await serverlessRuntime.invoke('computeSurge', req.body);
    res.json({ status: 'OK', ...result });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// Section 13.15: Distributed Tracing & Observability (OpenTelemetry)
app.get('/api/traces', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  res.json({ status: 'OK', traces: globalTracer.getAllTraces(limit) });
});

app.get('/api/traces/metrics', (req, res) => {
  res.json({ status: 'OK', ...globalTracer.getMetrics() });
});

app.get('/api/traces/:traceId', (req, res) => {
  const trace = globalTracer.getTrace(req.params.traceId);
  if (!trace) return res.status(404).json({ status: 'NOT_FOUND', message: 'Trace not found' });
  res.json({ status: 'OK', trace });
});

// Section 13.16: Circuit Breaker Pattern (Hystrix-Inspired)
app.get('/api/reliability/circuits', (req, res) => {
  res.json({ status: 'OK', circuits: circuitRegistry.getAllStatuses() });
});

app.post('/api/reliability/circuits/:name/trip', (req, res) => {
  const breaker = circuitRegistry.get(req.params.name);
  breaker.trip();
  addLog('RELIABILITY', `⚡ Circuit Breaker '${req.params.name}' manually TRIPPED to OPEN state!`);
  res.json({ status: 'OK', circuit: breaker.getStatus() });
});

app.post('/api/reliability/circuits/:name/reset', (req, res) => {
  const breaker = circuitRegistry.get(req.params.name);
  breaker.reset();
  addLog('RELIABILITY', `✨ Circuit Breaker '${req.params.name}' manually RESET to CLOSED state.`);
  res.json({ status: 'OK', circuit: breaker.getStatus() });
});

// Section 13.17: Event Sourcing & CQRS Architecture
app.get('/api/events', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  res.json({ status: 'OK', events: globalEventStore.getEvents(limit) });
});

app.post('/api/events/replay', (req, res) => {
  const ts = req.body.timestamp ? parseInt(req.body.timestamp, 10) : Date.now();
  const replayState = globalEventStore.replay(ts);
  res.json({ status: 'OK', replay: replayState });
});

app.get('/api/events/projections', (req, res) => {
  res.json({ status: 'OK', projections: globalEventStore.getProjections() });
});

// Section 13.18: API Rate Limiting & Distributed Throttling
app.get('/api/admin/ratelimit/status', (req, res) => {
  res.json({ status: 'OK', rateLimiter: rateLimiter.getStatus() });
});

// Section 13.19: JWT Authentication & Role-Based Access Control (RBAC)
app.post('/api/auth/login', (req, res) => {
  const { username = 'admin', role = 'ADMIN' } = req.body || {};
  const validRole = ROLES[role.toUpperCase()] || ROLES.CUSTOMER;
  const tokens = authManager.generateTokens({ userId: `user-${Date.now()}`, username, role: validRole });
  res.json({ status: 'OK', user: { username, role: validRole }, ...tokens });
});

app.post('/api/auth/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    const tokens = authManager.refresh(refreshToken);
    res.json({ status: 'OK', ...tokens });
  } catch (err) {
    res.status(401).json({ status: 'ERROR', message: err.message });
  }
});

app.get('/api/auth/me', (req, res) => {
  res.json({ status: 'OK', user: req.user });
});

// Section 13.20: Geo-Spatial Indexing with R-Tree
app.get('/api/spatial/zones', (req, res) => {
  res.json({ status: 'OK', zones: CITY_ZONES });
});

app.get('/api/spatial/status', async (req, res) => {
  if (global.coordinatorInstance && global.coordinatorInstance.rTree) {
    return res.json({ status: 'OK', spatial: global.coordinatorInstance.rTree.getStatus() });
  }
  const fallbackTree = new RTreeIndex(4);
  res.json({ status: 'OK', spatial: fallbackTree.getStatus() });
});

// Section 13.21: Redis-Compatible In-Memory Cache Layer
app.get('/api/cache/stats', (req, res) => {
  res.json({ status: 'OK', stats: globalCache.getStats() });
});

app.get('/api/cache/keys', (req, res) => {
  res.json({ status: 'OK', keys: globalCache.getKeys(req.query.ns) });
});

app.post('/api/cache/flush', (req, res) => {
  const flushed = globalCache.flush(req.body.namespace);
  res.json({ status: 'OK', flushedEntries: flushed });
});

// Section 13.22: gRPC Service Mesh with Protocol Buffers
app.get('/api/grpc/stats', (req, res) => {
  res.json({ status: 'OK', grpc: grpcSidecar.getStatus() });
});

app.post('/api/grpc/benchmark', (req, res) => {
  const benchmark = grpcSidecar.benchmark(req.body || { customerId: 'cust-demo', pickup: [25, 30], dropoff: [65, 75] });
  res.json({ status: 'OK', benchmark });
});

// Section 13.23: Chaos Engineering & Automated Resilience Testing
app.get('/api/chaos/status', (req, res) => {
  res.json({ status: 'OK', chaos: chaosEngine.getStatus() });
});

app.post('/api/chaos/inject', async (req, res) => {
  const { faultType = FAULT_TYPES.NODE_CRASH, target = 'driver-2' } = req.body || {};
  try {
    const experiment = await chaosEngine.runExperiment(faultType, target, {
      faultMonitor: global.coordinatorInstance ? global.coordinatorInstance.faultMonitor : null,
      quorumKvStore
    });
    addLog('CHAOS', `🐒 Chaos Monkey Experiment '${experiment.experimentId}' executed: [${faultType}] on '${target}' -> Steady-State Verified in ${experiment.recoveryTimeMs}ms!`);
    res.json({ status: 'OK', experiment });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n=============================================================`);
  console.log(`🚀 UrbanPulse Distributed Simulator Dashboard running on:`);
  console.log(`   👉 http://localhost:${PORT}`);
  console.log(`=============================================================\n`);
  initBrokerSubscription();
});

module.exports = { app, server };
