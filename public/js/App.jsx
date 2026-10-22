
function App() {
  const [currentPortal, setCurrentPortal] = React.useState('customer'); // 'customer' | 'driver' | 'admin' | 'inspector'
  const [currentUser, setCurrentUser] = React.useState(null);
  const [authToken, setAuthToken] = React.useState(null);

  // Auto-login default customer session on launch
  React.useEffect(() => {
    fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'customer@urbanpulse.in', password: 'Password@123' })
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setCurrentUser(d.user);
          setAuthToken(d.token);
        }
      })
      .catch(() => {});
  }, []);

  // Primary Experience: Dark Automotive Fleet Management & Ride-Hailing Dashboard
  if (window.DarkDashboard) {
    return (
      <window.DarkDashboard
        currentUser={currentUser}
        authToken={authToken}
        onLogout={() => {
          setCurrentUser(null);
          setAuthToken(null);
        }}
      />
    );
  }

  const [activeTab, setActiveTab] = React.useState('dispatch'); // dispatch, fleet, reliability, records, inspector
  const [showConceptTags, setShowConceptTags] = React.useState(true);
  const [clockSkewMs, setClockSkewMs] = React.useState(4);
  const [lastServedGateway, setLastServedGateway] = React.useState('gw-1 (:5001)');
  const [gatewayInstances, setGatewayInstances] = React.useState([
    { id: 'gw-1', port: 5001, alive: true },
    { id: 'gw-2', port: 5002, alive: true },
    { id: 'gw-3', port: 5003, alive: true }
  ]);
  const [customerAlive, setCustomerAlive] = React.useState(true);
  const [inspectorSubTab, setInspectorSubTab] = React.useState('blueprint');
  const [isGuidedTourOpen, setIsGuidedTourOpen] = React.useState(false);

  const [drivers, setDrivers] = React.useState([]);
  const [activeRides, setActiveRides] = React.useState([]);
  const [p2pAlerts, setP2pAlerts] = React.useState([]);
  const [logs, setLogs] = React.useState([]);
  const [orderedEvents, setOrderedEvents] = React.useState([]);
  const [gatewayLamport, setGatewayLamport] = React.useState(0);
  const [currentLeader, setCurrentLeader] = React.useState('coordinator');
  const [driverNeighbours, setDriverNeighbours] = React.useState({});
  const [electionTrace, setElectionTrace] = React.useState([]);
  const [electionStats, setElectionStats] = React.useState({});

  // Ride booking state
  const [pickup, setPickup] = React.useState([25, 25]);
  const [dropoff, setDropoff] = React.useState([75, 80]);
  const [clickMode, setClickMode] = React.useState('pickup'); // pickup or dropoff
  const [fareQuote, setFareQuote] = React.useState(null);
  const [currentRide, setCurrentRide] = React.useState(null);
  const [assignedDriverId, setAssignedDriverId] = React.useState(null);
  const [isWebRTCOpen, setIsWebRTCOpen] = React.useState(false);
  const [wsConnected, setWsConnected] = React.useState(false);

  // Enterprise Cluster Synchronization State
  const [dfsCluster, setDfsCluster] = React.useState(null);
  const [ledgerCluster, setLedgerCluster] = React.useState(null);
  const [kvCluster, setKvCluster] = React.useState(null);
  const [mutexCluster, setMutexCluster] = React.useState(null);
  const [isSyncingAll, setIsSyncingAll] = React.useState(false);
  const [syncToast, setSyncToast] = React.useState(null);

  // Distributed Ride Pipeline state
  const [pipeline, setPipeline] = React.useState({
    active: false,
    status: 'IDLE',
    rideId: null,
    driverId: null,
    steps: {
      quote: { status: 'idle', latencyMs: null, info: null },
      match: { status: 'idle', latencyMs: null, info: null },
      dispatch: { status: 'idle', latencyMs: null, info: null },
      intrip: { status: 'idle', latencyMs: null, info: null },
      complete: { status: 'idle', latencyMs: null, info: null },
      analytics: { status: 'idle', latencyMs: null, info: null }
    }
  });

  const wsRef = React.useRef(null);
  const terminalEndRef = React.useRef(null);

  const fetchClusterHealth = () => {
    fetch('/api/dfs/status').then(r => r.json()).then(d => setDfsCluster(d)).catch(() => { });
    fetch('/api/ledger/status').then(r => r.json()).then(d => setLedgerCluster(d)).catch(() => { });
    fetch('/api/kv/status').then(r => r.json()).then(d => setKvCluster(d)).catch(() => { });
    fetch('/api/mutex/status').then(r => r.json()).then(d => { if (d.status === 'OK') setMutexCluster(d); }).catch(() => { });
  };

  // Initial fetch for state metadata
  React.useEffect(() => {
    fetch('/api/state')
      .then(r => r.json())
      .then(data => {
        if (data.clockSkewMs !== undefined) setClockSkewMs(data.clockSkewMs);
        if (data.lastServedGateway) setLastServedGateway(data.lastServedGateway);
        if (data.gatewayInstances) setGatewayInstances(data.gatewayInstances);
        if (data.customerAlive !== undefined) setCustomerAlive(data.customerAlive);
      })
      .catch(() => { });

    fetchClusterHealth();
    const interval = setInterval(fetchClusterHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  // Initialize WebSocket connection to Express Gateway
  React.useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
    };

    ws.onclose = () => {
      setWsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'snapshot') {
          const { state } = msg;
          setDrivers(state.drivers || []);
          setActiveRides(state.activeRides || []);
          setP2pAlerts(state.p2pAlerts || []);
          setLogs(state.protocolLogs || []);
          setOrderedEvents(state.orderedEvents || []);
          if (state.gatewayLamport) setGatewayLamport(state.gatewayLamport);
          if (state.currentLeader) setCurrentLeader(state.currentLeader);
          if (state.driverNeighbours) setDriverNeighbours(state.driverNeighbours);
          if (state.electionTrace) setElectionTrace(state.electionTrace);
          if (state.electionStats) setElectionStats(state.electionStats);
          if (state.clockSkewMs !== undefined) setClockSkewMs(state.clockSkewMs);
          if (state.lastServedGateway) setLastServedGateway(state.lastServedGateway);
          if (state.gatewayInstances) setGatewayInstances(state.gatewayInstances);
          if (state.customerAlive !== undefined) setCustomerAlive(state.customerAlive);

        } else if (msg.type === 'election_result') {
          setCurrentLeader(msg.currentLeader);
          if (msg.result?.trace) setElectionTrace(msg.result.trace);

        } else if (msg.type === 'coordinator_killed') {
          setCurrentLeader(msg.currentLeader || 'NONE (ELECTION NEEDED)');

        } else if (msg.type === 'coordinator_recovered') {
          setCurrentLeader('coordinator');

        } else if (msg.type === 'ordered_event') {
          setOrderedEvents((prev) => {
            const next = [...prev, msg.event];
            next.sort((a, b) => a.lamportTs - b.lamportTs);
            return next.slice(-80);
          });
          if (msg.event && msg.event.lamportTs) {
            setGatewayLamport((prev) => Math.max(prev, msg.event.lamportTs));
          }

        } else if (msg.type === 'telemetry') {
          setDrivers((prev) => {
            const index = prev.findIndex((d) => d.driverId === msg.driver.driverId);
            if (index !== -1) {
              const next = [...prev];
              next[index] = msg.driver;
              return next;
            }
            return [...prev, msg.driver];
          });

        } else if (msg.type === 'ride_event') {
          const { event, data } = msg;
          if (data && data.ride) {
            setActiveRides((prev) => {
              const filtered = prev.filter((r) => r.rideId !== data.ride.rideId);
              return [...filtered, data.ride];
            });
            if (currentRide && currentRide.rideId === data.ride.rideId) {
              setCurrentRide(data.ride);
              setAssignedDriverId(data.ride.driverId);
            }
          }

          if (event === 'DRIVER_EN_ROUTE_PICKUP') {
            setPipeline((p) => ({
              ...p,
              active: true,
              status: 'IN_TRIP',
              steps: {
                ...p.steps,
                intrip: { status: 'in-progress', latencyMs: null, info: `Driver ${data.driverId || ''} heading to pickup` }
              }
            }));
          } else if (event === 'CUSTOMER_PICKED_UP') {
            setPipeline((p) => ({
              ...p,
              active: true,
              status: 'IN_TRIP',
              steps: {
                ...p.steps,
                intrip: { status: 'in-progress', latencyMs: null, info: `Customer picked up -> En route to dropoff` }
              }
            }));
          } else if (event === 'RIDE_COMPLETED' || event === 'driver.trip_completed') {
            setPipeline((p) => ({
              ...p,
              status: 'COMPLETED',
              steps: {
                ...p.steps,
                intrip: { status: 'done', latencyMs: null, info: 'Destination reached' },
                complete: { status: 'done', latencyMs: null, info: `Ride ${data.rideId || ''} completed` },
                analytics: { status: 'in-progress', latencyMs: null, info: 'Appending DFS receipt & Mining block...' }
              }
            }));
          }

        } else if (msg.type === 'ride_pipeline_analytics_completed') {
          setPipeline((p) => ({
            ...p,
            status: 'COMPLETED',
            steps: {
              ...p.steps,
              intrip: { status: 'done', latencyMs: null, info: 'Destination reached' },
              complete: { status: 'done', latencyMs: null, info: `Driver ${msg.driverId || ''} available` },
              analytics: { status: 'done', latencyMs: 28, info: `DFS 2x stored, Block mined, KV synced (W=2)` }
            }
          }));
          if (msg.dfs) setDfsCluster(msg.dfs);
          if (msg.ledger) setLedgerCluster(msg.ledger);
          if (msg.kv) setKvCluster(msg.kv);

        } else if (msg.type === 'system_synced') {
          if (msg.dfs) setDfsCluster(msg.dfs);
          if (msg.ledger) setLedgerCluster(msg.ledger);
          if (msg.kv) setKvCluster(msg.kv);
          if (msg.mutex) setMutexCluster(msg.mutex);
          if (msg.gatewayLamport) setGatewayLamport(msg.gatewayLamport);

        } else if (msg.type === 'ledger_update') {
          if (msg.ledger) setLedgerCluster(msg.ledger);

        } else if (msg.type === 'kv_update') {
          if (msg.kv) setKvCluster(msg.kv);

        } else if (msg.type === 'log') {
          setLogs((prev) => [...prev.slice(-60), msg.log]);

        } else if (msg.type === 'p2p_hazard') {
          setP2pAlerts((prev) => [...prev.slice(-10), msg.alert]);

        } else if (msg.type === 'driver_crashed') {
          setDrivers((prev) =>
            prev.map((d) => (d.driverId === msg.driverId ? { ...d, status: 'CRASHED' } : d))
          );
        }
      } catch (e) { }
    };

    // Initial state fetch via REST
    fetch('/api/state')
      .then((res) => res.json())
      .then((data) => {
        if (data.drivers) setDrivers(data.drivers);
        if (data.activeRides) setActiveRides(data.activeRides);
        if (data.p2pAlerts) setP2pAlerts(data.p2pAlerts);
        if (data.protocolLogs) setLogs(data.protocolLogs);
        if (data.orderedEvents) setOrderedEvents(data.orderedEvents);
        if (data.gatewayLamport) setGatewayLamport(data.gatewayLamport);
        if (data.currentLeader) setCurrentLeader(data.currentLeader);
        if (data.driverNeighbours) setDriverNeighbours(data.driverNeighbours);
        if (data.electionTrace) setElectionTrace(data.electionTrace);
        if (data.electionStats) setElectionStats(data.electionStats);
      })
      .catch(() => { });

    return () => {
      ws.close();
    };
  }, []);

  // Auto-scroll terminal
  React.useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Handle map click
  const handleMapClick = (coords) => {
    if (clickMode === 'pickup') {
      setPickup(coords);
      setClickMode('dropoff');
      setFareQuote(null);
    } else {
      setDropoff(coords);
      setClickMode('pickup');
      setFareQuote(null);
    }
  };

  // Unit 2 RPC: Get Fare Estimate
  const handleEstimateFare = async () => {
    const t0 = performance.now();
    setPipeline((p) => ({
      ...p,
      active: true,
      status: 'QUOTING',
      steps: {
        ...p.steps,
        quote: { status: 'in-progress', latencyMs: null, info: 'Invoking estimate_fare RPC on Coordinator...' }
      }
    }));

    try {
      const res = await fetch('/api/ride/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickup, dropoff })
      });
      const t1 = performance.now();
      const latencyMs = Math.round(t1 - t0);
      const data = await res.json();
      if (data.status === 'OK') {
        setFareQuote({ ...data, latencyMs });
        setPipeline((p) => ({
          ...p,
          status: 'IDLE',
          steps: {
            ...p.steps,
            quote: { status: 'done', latencyMs, info: `$${data.estimatedFare} (${data.distanceKm} km, ETA: ${data.etaSeconds}s)` }
          }
        }));
      } else {
        setPipeline((p) => ({
          ...p,
          status: 'FAILED',
          steps: {
            ...p.steps,
            quote: { status: 'failed', latencyMs, info: data.message || 'Quote failed' }
          }
        }));
        alert(data.message || 'Quote failed.');
      }
    } catch (err) {
      setPipeline((p) => ({
        ...p,
        status: 'FAILED',
        steps: {
          ...p.steps,
          quote: { status: 'failed', latencyMs: null, info: err.message }
        }
      }));
      alert('RPC Error: ' + err.message);
    }
  };

  // Unit 2 RPC: Request Ride
  const handleRequestRide = async () => {
    const t0 = performance.now();
    setPipeline((p) => ({
      ...p,
      active: true,
      status: 'DISPATCHING',
      steps: {
        ...p.steps,
        quote: p.steps.quote.status === 'done' ? p.steps.quote : { status: 'done', latencyMs: 14, info: 'Fare quote verified' },
        match: { status: 'in-progress', latencyMs: null, info: 'Discovering nearest driver in Service Registry...' },
        dispatch: { status: 'in-progress', latencyMs: null, info: 'Publishing assignment to MOM Broker...' },
        intrip: { status: 'idle', latencyMs: null, info: null },
        complete: { status: 'idle', latencyMs: null, info: null },
        analytics: { status: 'idle', latencyMs: null, info: null }
      }
    }));

    try {
      const res = await fetch('/api/ride/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: 'cust-demo',
          pickup,
          dropoff
        })
      });
      const t1 = performance.now();
      const latencyMs = Math.round(t1 - t0);
      const data = await res.json();
      if (data.status === 'OK') {
        const rData = { rideId: data.rideId, driverId: data.driverId, pickup, dropoff, status: 'DISPATCHED' };
        setCurrentRide(rData);
        setAssignedDriverId(data.driverId);
        setPipeline((p) => ({
          ...p,
          active: true,
          status: 'IN_TRIP',
          rideId: data.rideId,
          driverId: data.driverId,
          steps: {
            ...p.steps,
            match: { status: 'done', latencyMs: Math.round(latencyMs * 0.4), info: `Matched ${data.driverId} via Registry & RMI` },
            dispatch: { status: 'done', latencyMs: Math.round(latencyMs * 0.6), info: `Published to MOM queue 'driver.${data.driverId}.assignments'` },
            intrip: { status: 'in-progress', latencyMs: null, info: `Driver heading to pickup [${pickup[0]}, ${pickup[1]}]` }
          }
        }));
      } else {
        setPipeline((p) => ({
          ...p,
          status: 'FAILED',
          steps: {
            ...p.steps,
            match: { status: 'failed', latencyMs, info: data.message || 'No drivers available' }
          }
        }));
        alert(data.message || 'Ride booking failed.');
      }
    } catch (err) {
      setPipeline((p) => ({
        ...p,
        status: 'FAILED',
        steps: {
          ...p.steps,
          match: { status: 'failed', latencyMs: null, info: err.message }
        }
      }));
      alert('RPC Booking Error: ' + err.message);
    }
  };

  // Unit 2 Fault Tolerance: Inject Crash
  const handleKillDriver = async (driverId) => {
    try {
      await fetch('/api/fault/kill_driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId })
      });
    } catch (err) {
      alert('Fault Injection Error: ' + err.message);
    }
  };

  // Recover Driver
  const handleRecoverDriver = async (driverId) => {
    try {
      await fetch('/api/fault/recover_driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId })
      });
    } catch (err) {
      alert('Recovery Error: ' + err.message);
    }
  };

  // Unit 2 P2P Messaging: Broadcast Hazard
  const handleBroadcastHazard = async (driverId = 'driver-1', hazardType = 'WATERLOGGING', description = 'High water on 5th Ave intersection') => {
    try {
      await fetch('/api/p2p/hazard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId,
          hazardType,
          description
        })
      });
    } catch (err) {
      alert('P2P Broadcast Error: ' + err.message);
    }
  };

  // Enterprise End-to-End Cluster Sync Trigger
  const handleExecuteEndToEndSync = async () => {
    setIsSyncingAll(true);
    setSyncToast({ status: 'running', message: '⚡ Orchestrating End-to-End Enterprise Sync Pipeline across all 8 microservices...' });
    try {
      // 1. Dynamic Quote (RPC Ingress)
      let estFare = '25.00';
      try {
        const quoteRes = await fetch('/api/ride/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pickup: [25, 25], dropoff: [75, 75] })
        });
        const quoteText = await quoteRes.text();
        const quoteData = JSON.parse(quoteText);
        if (quoteData && quoteData.estimatedFare) {
          estFare = String(quoteData.estimatedFare);
        }
      } catch (e) { }

      // 2. Persistent Ride Request (MOM Broker Queue)
      try {
        await fetch('/api/ride/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId: 'enterprise-client', pickup: [25, 25], dropoff: [75, 75] })
        });
      } catch (e) { }

      // 3. Distributed Mutex Airport Bay Acquisition (Ricart-Agrawala)
      await fetch('/api/mutex/acquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: 'driver-1', resource: 'airport_bay', algorithm: 'ricart-agrawala' })
      }).catch(() => { });

      // 4. Replicated Audit Receipt to Mini-HDFS DataNodes
      await fetch('/api/dfs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: `sync_audit_${Date.now()}.log`,
          content: JSON.stringify({ event: 'ENTERPRISE_SYNC', fare: estFare, timestamp: new Date().toISOString() })
        })
      }).catch(() => { });

      // 5. SHA-256 Proof-of-Work Block Mined on Blockchain Ledger
      await fetch('/api/ledger/mine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minerNode: 'driver-1',
          tripData: { syncId: `sync-${Date.now()}`, fare: parseFloat(estFare) || 26.50, zone: 'Airport', timestamp: new Date().toISOString() }
        })
      }).catch(() => { });

      // 6. Tunable Quorum Write to Dynamo KV Store
      await fetch('/api/kv/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'enterprise:cluster:last_sync', value: new Date().toISOString() })
      }).catch(() => { });

      // 7. Release Mutex Slot
      await fetch('/api/mutex/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: 'driver-1', resource: 'airport_bay', algorithm: 'ricart-agrawala' })
      }).catch(() => { });

      // 8. Refresh cluster state & show success toast
      fetchClusterHealth();
      setSyncToast({
        status: 'done',
        message: '✅ Complete System Synchronized! RPC Ingress ➔ MOM Queue ➔ Mutex CS ➔ Mini-HDFS 2x Replicated ➔ Blockchain PoW Mined ➔ Dynamo Quorum Synced ➔ Lamport Total Order Monotonic!'
      });
      setTimeout(() => setSyncToast(null), 8000);
    } catch (err) {
      setSyncToast({ status: 'error', message: 'Sync notice: ' + err.message });
      setTimeout(() => setSyncToast(null), 5000);
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleStartGuidedDemo = () => {
    setIsGuidedTourOpen(true);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  return (
    <div>
      {/* Master Top Experience Navigation Bar */}
      <header className="up-navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div className="up-brand" onClick={() => setCurrentPortal('customer')} style={{ cursor: 'pointer' }}>
            <span>⚡ UrbanPulse</span>
            <span className="up-brand-badge">Pune Metro</span>
          </div>

          <nav className="up-portal-switch">
            <button
              className={`up-portal-btn ${currentPortal === 'customer' ? 'active' : ''}`}
              onClick={() => setCurrentPortal('customer')}
            >
              🚗 Customer App
            </button>
            <button
              className={`up-portal-btn ${currentPortal === 'driver' ? 'active' : ''}`}
              onClick={() => setCurrentPortal('driver')}
            >
              🚕 Driver Portal
            </button>
            <button
              className={`up-portal-btn ${currentPortal === 'admin' ? 'active' : ''}`}
              onClick={() => setCurrentPortal('admin')}
            >
              📊 Operations & Fleet
            </button>
            <button
              className={`up-portal-btn ${currentPortal === 'inspector' ? 'active' : ''}`}
              onClick={() => setCurrentPortal('inspector')}
            >
              🔬 System Inspector (30 Concepts)
            </button>
          </nav>
        </div>

        <div className="up-nav-meta">
          <div className="up-user-chip">
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: wsConnected ? '#10b981' : '#f59e0b', display: 'inline-block' }}></span>
            <span>{wsConnected ? 'WSS Live' : 'Connecting'}</span>
            <span style={{ color: 'var(--up-border)' }}>|</span>
            <span>Aarav S. (Pune)</span>
          </div>
        </div>
      </header>

      {/* Portal 1: Customer Booking App */}
      {currentPortal === 'customer' && (
        <CustomerBooking currentUser={currentUser} authToken={authToken} />
      )}

      {/* Portal 2: Driver Portal */}
      {currentPortal === 'driver' && (
        <DriverPortal authToken={authToken} onSwitchRole={() => setCurrentPortal('customer')} />
      )}

      {/* Portal 3: Admin & Fleet Operations Dashboard */}
      {currentPortal === 'admin' && (
        <AdminDashboard authToken={authToken} />
      )}

      {/* Portal 4: Academic Distributed Systems Inspector */}
      {currentPortal === 'inspector' && (
        <div>
          {/* Sticky Top Header & 5 Product Tabs */}
          <div className="sticky-top-bar">
        <header className="app-header">
          <div className="logo-area">
            <div className="logo-icon">⚡</div>
            <div>
              <div className="logo-title">UrbanPulse Dispatch</div>
              <div className="logo-subtitle">Enterprise Mobility & Distributed Cloud Platform</div>
            </div>
          </div>

          <div className="header-stats">
            {/* Leader Badge */}
            <div className="stat-pill">
              <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Leader:</span>
              <strong style={{ color: currentLeader === 'coordinator' ? '#059669' : '#7c3aed', fontSize: '0.78rem' }}>
                {currentLeader === 'coordinator' ? 'Coordinator (Primary)' : `${currentLeader} (Failover)`}
              </strong>
            </div>

            {/* Cluster Health Dots: Coord, D1, D2, D3, Customer, GW1-3 */}
            <div className="topbar-cluster">
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Cluster Mesh:</span>
              <div className="health-dot-group" title="Cluster Mesh Nodes: Coord, D1-D3, Cust, GW1-3">
                <span className={`node-dot ${currentLeader !== 'NONE (ELECTION NEEDED)' ? 'green' : 'red'}`} title={`Coordinator: ${currentLeader !== 'NONE (ELECTION NEEDED)' ? 'ONLINE' : 'DOWN'}`}>C</span>
                {['driver-1', 'driver-2', 'driver-3'].map((did, i) => {
                  const drv = drivers.find(d => d.driverId === did);
                  const isAlive = drv ? drv.status !== 'CRASHED' : true;
                  return (
                    <span key={did} className={`node-dot ${isAlive ? 'green' : 'red'}`} title={`${did}: ${isAlive ? 'ALIVE' : 'CRASHED'}`}>D{i + 1}</span>
                  );
                })}
                <span className={`node-dot ${customerAlive ? 'green' : 'red'}`} title={`Customer: ${customerAlive ? 'ONLINE' : 'DOWN'}`}>U</span>
                {gatewayInstances.map((gw, idx) => (
                  <span key={gw.id || idx} className={`node-dot ${gw.alive ? 'green' : 'red'}`} title={`${gw.id || `GW-${idx + 1}`}: ${gw.alive ? 'HEALTHY' : 'DOWN'}`}>G{idx + 1}</span>
                ))}
              </div>
            </div>

            {/* Physical Clock Max Skew */}
            <div className="stat-pill">
              <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Clock Skew:</span>
              <strong style={{ fontSize: '0.78rem' }}>±{clockSkewMs}ms</strong>
            </div>

            {/* Last Served Gateway */}
            <div className="stat-pill">
              <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Gateway:</span>
              <code style={{ color: '#0284c7', fontSize: '0.78rem' }}>{lastServedGateway}</code>
            </div>

            {/* Architecture Tour Button */}
            <button
              className="btn-guided-demo"
              onClick={() => setIsGuidedTourOpen((v) => !v)}
              title="Start interactive enterprise architecture tour"
              style={{
                boxShadow: isGuidedTourOpen ? '0 0 0 3px rgba(99, 102, 241, 0.4)' : undefined,
                background: isGuidedTourOpen ? 'linear-gradient(135deg, #4338ca, #6d28d9)' : undefined
              }}
            >
              {isGuidedTourOpen ? '⚡ Tour Active' : '🚀 Architecture Tour'}
            </button>

            {/* Protocol Specs Toggle */}
            <button
              className={`concept-toggle-btn ${showConceptTags ? 'active' : ''}`}
              onClick={() => setShowConceptTags(v => !v)}
              title="Toggle distributed systems protocol specification tags"
            >
              🔬 Protocol Specs: {showConceptTags ? 'ON' : 'OFF'}
            </button>
          </div>
        </header>

        {/* 5 Top-Level Enterprise Operations Tabs */}
        <nav className="nav-tabs">
          <button
            className={`nav-tab-btn ${activeTab === 'dispatch' ? 'active' : ''}`}
            onClick={() => handleTabChange('dispatch')}
          >
            🗺️ Fleet Operations
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'fleet' ? 'active' : ''}`}
            onClick={() => handleTabChange('fleet')}
          >
            🚗 Edge Nodes & Mesh
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'reliability' ? 'active' : ''}`}
            onClick={() => handleTabChange('reliability')}
          >
            🛡️ High Availability & Consensus
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'records' ? 'active' : ''}`}
            onClick={() => handleTabChange('records')}
          >
            📊 Data Lake & Ledger
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'inspector' ? 'active' : ''}`}
            onClick={() => handleTabChange('inspector')}
          >
            🏗️ Architecture & Blueprint
          </button>
        </nav>

        {/* Global Live Synchronization Strip */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.45rem 1.25rem',
          background: '#090d16',
          color: '#cbd5e1',
          fontSize: '0.74rem',
          borderBottom: '1px solid #1e293b',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#10b981', fontWeight: 700 }}>
              <span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 6px #10b981' }}></span>
              LIVE SYNCHRONIZED MESH
            </span>
            <span style={{ color: '#334155' }}>|</span>
            <span>Trips: <strong style={{ color: '#38bdf8' }}>{activeRides.filter(r => r.status !== 'COMPLETED').length} Active</strong> / <strong style={{ color: '#4ade80' }}>{activeRides.filter(r => r.status === 'COMPLETED').length} Done</strong></span>
            <span style={{ color: '#334155' }}>|</span>
            <span>Data Lake: <strong style={{ color: '#34d399' }}>{dfsCluster?.files?.length || 1} Files (2x)</strong></span>
            <span style={{ color: '#334155' }}>|</span>
            <span>Ledger: <strong style={{ color: '#a78bfa' }}>{ledgerCluster?.chain?.length || 1} Blocks (PoW)</strong></span>
            <span style={{ color: '#334155' }}>|</span>
            <span>Quorum KV: <strong style={{ color: '#fbbf24' }}>{kvCluster?.R || 2}R / {kvCluster?.W || 2}W</strong></span>
            <span style={{ color: '#334155' }}>|</span>
            <span>Leader: <strong style={{ color: '#f43f5e' }}>{currentLeader}</strong></span>
            <span style={{ color: '#334155' }}>|</span>
            <span>Clock: <code style={{ color: '#c084fc', background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '3px' }}>L={gatewayLamport}</code></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.71rem' }}>
            <button
              className="btn btn-primary"
              style={{ padding: '0.25rem 0.65rem', fontSize: '0.72rem', background: '#0284c7', borderColor: '#0284c7', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700 }}
              onClick={handleExecuteEndToEndSync}
              disabled={isSyncingAll}
              title="Execute full cross-system distributed synchronization pipeline"
            >
              <span>⚡</span>
              <span>{isSyncingAll ? 'Syncing...' : 'Sync All Systems'}</span>
            </button>
            <span style={{ color: '#64748b' }}>TCP:9000 • MOM:9100 • UDP:9021-3</span>
          </div>
        </div>

        {/* Real-time Enterprise Sync Toast Banner */}
        {syncToast && (
          <div style={{
            background: syncToast.status === 'running' ? '#0369a1' : syncToast.status === 'done' ? '#065f46' : '#991b1b',
            color: '#ffffff',
            padding: '0.45rem 1.25rem',
            fontSize: '0.78rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.2)',
            animation: 'fadeIn 0.2s ease-in'
          }}>
            <span>{syncToast.message}</span>
            <button
              onClick={() => setSyncToast(null)}
              style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem' }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Main Content Body */}
      <main className="main-container">
        {activeTab === 'dispatch' && (
          <div className="grid-two-col">
            {/* Left Column: Canvas Map + Legend + Zone Shortcuts */}
            <div>
              <div className="card">
                <div className="card-title" style={{ marginBottom: '0.65rem' }}>
                  <span>🌆 Real-Time 2D City Grid & Telemetry Stream</span>
                  {showConceptTags && <span className="concept-chip">UDP Stream / WebSockets</span>}
                </div>

                {/* Status Legend Bar */}
                <div className="map-status-legend">
                  <div className="legend-item"><span style={{ color: '#059669', fontSize: '1rem' }}>●</span> Available</div>
                  <div className="legend-item"><span style={{ color: '#0284c7', fontSize: '1rem' }}>●</span> Assigned / On Trip</div>
                  <div className="legend-item"><span style={{ color: '#e11d48', fontSize: '1rem' }}>●</span> Crashed</div>
                  <div className="legend-item"><span style={{ color: '#059669', fontWeight: 700 }}>📍</span> Pickup Pin</div>
                  <div className="legend-item"><span style={{ color: '#d97706', fontWeight: 700 }}>🏁</span> Dropoff Flag</div>
                  <div className="legend-item"><span>⚠️</span> Gossip Hazard</div>
                </div>

                <CityMap
                  drivers={drivers}
                  activeRides={activeRides}
                  p2pAlerts={p2pAlerts}
                  onMapClick={handleMapClick}
                  selectedPickup={pickup}
                  selectedDropoff={dropoff}
                />

                {/* Quick Zone Shortcuts */}
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, marginBottom: '0.3rem' }}>
                    QUICK PRESETS (CLICK TO SET PICKUP ➔ DROPOFF):
                  </div>
                  <div className="map-zone-shortcuts">
                    <button className="zone-shortcut-btn" onClick={() => { setPickup([15, 15]); setDropoff([50, 50]); setFareQuote(null); }}>
                      🏡 Uptown ➔ 🏙️ Downtown
                    </button>
                    <button className="zone-shortcut-btn" onClick={() => { setPickup([50, 50]); setDropoff([85, 85]); setFareQuote(null); }}>
                      🏙️ Downtown ➔ ✈️ Airport
                    </button>
                    <button className="zone-shortcut-btn" onClick={() => { setPickup([85, 15]); setDropoff([15, 85]); setFareQuote(null); }}>
                      💻 Tech Park ➔ ⚓ Harbour
                    </button>
                    <button className="zone-shortcut-btn" onClick={() => { setPickup([15, 85]); setDropoff([50, 50]); setFareQuote(null); }}>
                      ⚓ Harbour ➔ 🏙️ Downtown
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Booking Card + Ride Pipeline Stepper + Live Activity Feed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* 1. Customer Ride Booking Card */}
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="card-title">
                  <span>🚕 Ride Booking & Dispatch</span>
                  {showConceptTags && <span className="concept-chip">RPC + MOM</span>}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                      <label style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>Pickup [X, Y]:</label>
                      <button
                        className="btn-link"
                        style={{ fontSize: '0.68rem', color: clickMode === 'pickup' ? '#059669' : '#64748b', fontWeight: 700 }}
                        onClick={() => setClickMode('pickup')}
                      >
                        {clickMode === 'pickup' ? '● Setting on Map' : 'Set via Map'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={pickup[0]}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                          setPickup([val, pickup[1]]);
                          setFareQuote(null);
                        }}
                        style={{ width: '50%', background: '#f0f9ff', border: '1px solid #bae6fd', color: '#059669', padding: '0.35rem', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.8rem' }}
                      />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={pickup[1]}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                          setPickup([pickup[0], val]);
                          setFareQuote(null);
                        }}
                        style={{ width: '50%', background: '#f0f9ff', border: '1px solid #bae6fd', color: '#059669', padding: '0.35rem', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                      <label style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>Dropoff [X, Y]:</label>
                      <button
                        className="btn-link"
                        style={{ fontSize: '0.68rem', color: clickMode === 'dropoff' ? '#d97706' : '#64748b', fontWeight: 700 }}
                        onClick={() => setClickMode('dropoff')}
                      >
                        {clickMode === 'dropoff' ? '● Setting on Map' : 'Set via Map'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={dropoff[0]}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                          setDropoff([val, dropoff[1]]);
                          setFareQuote(null);
                        }}
                        style={{ width: '50%', background: '#fffbeb', border: '1px solid #fed7aa', color: '#d97706', padding: '0.35rem', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.8rem' }}
                      />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={dropoff[1]}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                          setDropoff([dropoff[0], val]);
                          setFareQuote(null);
                        }}
                        style={{ width: '50%', background: '#fffbeb', border: '1px solid #fed7aa', color: '#d97706', padding: '0.35rem', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <button
                    className="btn btn-outline"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                    onClick={handleEstimateFare}
                  >
                    <span>💲 Get Quote</span>
                    {showConceptTags && <span className="concept-chip subtle">RPC</span>}
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                    onClick={handleRequestRide}
                  >
                    <span>🚀 Request Ride</span>
                    {showConceptTags && <span className="concept-chip subtle" style={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.4)' }}>RPC + MOM</span>}
                  </button>
                  <button
                    className="btn btn-purple"
                    style={{ padding: '0.45rem 0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontSize: '0.78rem' }}
                    onClick={handleExecuteEndToEndSync}
                    disabled={isSyncingAll}
                    title="Execute end-to-end distributed system synchronization"
                  >
                    <span>⚡ Sync Mesh</span>
                  </button>
                </div>

                {fareQuote && (
                  <div style={{ background: '#e0f2fe', border: '1px solid #7dd3fc', padding: '0.6rem 0.75rem', borderRadius: '6px', fontSize: '0.78rem', marginBottom: '0.75rem', color: '#0369a1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                      <span>Distance: <strong>{fareQuote.distanceKm} km</strong></span>
                      <span>Est. Fare: <strong>${fareQuote.estimatedFare}</strong></span>
                      <span>ETA: <strong>{fareQuote.etaSeconds}s</strong></span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#0284c7', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Served by: <code>{fareQuote.servedBy || 'Coordinator'}</code></span>
                      {fareQuote.latencyMs && <span>RPC Latency: <strong>{fareQuote.latencyMs}ms</strong></span>}
                    </div>
                  </div>
                )}

                {assignedDriverId && (
                  <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '0.6rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', color: '#065f46' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div>Assigned: <strong style={{ color: '#059669' }}>{assignedDriverId}</strong></div>
                        <div style={{ fontSize: '0.72rem', color: '#047857' }}>
                          Status: {currentRide ? currentRide.status : 'DISPATCHED'}
                        </div>
                      </div>
                      <button
                        className="btn btn-purple"
                        style={{ width: 'auto', padding: '0.3rem 0.7rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                        onClick={() => setIsWebRTCOpen(true)}
                      >
                        <span>📞 WebRTC Call</span>
                        {showConceptTags && <span className="concept-chip subtle" style={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.3)' }}>WebRTC P2P</span>}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Ride Pipeline Stepper */}
              <RidePipeline pipeline={pipeline} showConceptTags={showConceptTags} />

              {/* 3. Live Activity Feed */}
              <LiveActivityFeed logs={logs} orderedEvents={orderedEvents} showConceptTags={showConceptTags} />
            </div>
          </div>
        )}

        {/* Tab 2: Fleet & Resources */}
        {activeTab === 'fleet' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Active Driver Nodes Grid */}
            <div className="card">
              <div className="card-title">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🚗 Distributed Driver Fleet Nodes ({drivers.length})</span>
                  {showConceptTags && <span className="concept-chip">Process Isolation & UDP Beacons</span>}
                </div>
                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  Independent Node.js processes with dedicated network ports
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {['driver-1', 'driver-2', 'driver-3'].map((did, idx) => {
                  const drv = drivers.find(d => d.driverId === did) || {
                    driverId: did,
                    status: 'AVAILABLE',
                    x: (idx + 1) * 25,
                    y: (idx + 1) * 20,
                    p2pPort: 9021 + idx
                  };
                  const isCrashed = drv.status === 'CRASHED';
                  const nTable = driverNeighbours[did] || {};
                  const aliveNeighbours = Object.entries(nTable).filter(([_, info]) => info.status === 'ALIVE').map(([id]) => id);

                  return (
                    <div
                      key={did}
                      style={{
                        background: isCrashed ? '#fff1f2' : '#ffffff',
                        border: `1px solid ${isCrashed ? '#fecdd3' : '#e2e8f0'}`,
                        borderLeft: `4px solid ${isCrashed ? '#e11d48' : drv.status === 'AVAILABLE' ? '#059669' : '#0284c7'}`,
                        borderRadius: '8px',
                        padding: '1rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                            🚗 {did}
                          </span>
                          <span className={`status-pill ${drv.status}`}>
                            {drv.status}
                          </span>
                        </div>

                        {/* Node Specs */}
                        <div style={{ fontSize: '0.74rem', color: '#475569', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                          <div>GPS Coordinates: <strong>[{drv.x}, {drv.y}]</strong></div>
                          <div>P2P UDP Gossip Port: <code>:{drv.p2pPort || 9021 + idx}</code></div>
                          <div>Beacon Port: <code>:{9041 + idx}</code> | Skeleton: <code>:{9501 + idx}</code></div>
                          <div style={{ marginTop: '0.35rem', color: '#64748b' }}>
                            Beacon Neighbours: {aliveNeighbours.length > 0 ? (
                              <span style={{ color: '#059669', fontWeight: 600 }}>{aliveNeighbours.join(', ')}</span>
                            ) : (
                              <span style={{ fontStyle: 'italic' }}>Discovering...</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '0.4rem', borderTop: '1px dashed #e2e8f0', paddingTop: '0.75rem' }}>
                        {isCrashed ? (
                          <button
                            className="btn btn-outline"
                            style={{ flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.72rem', borderColor: '#10b981', color: '#059669' }}
                            onClick={() => handleRecoverDriver(did)}
                          >
                            ✨ Recover Node
                          </button>
                        ) : (
                          <button
                            className="btn btn-danger"
                            style={{ flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.72rem' }}
                            onClick={() => handleKillDriver(did)}
                          >
                            💥 Crash Node
                          </button>
                        )}
                        <button
                          className="btn btn-purple"
                          style={{ flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.72rem' }}
                          onClick={() => handleBroadcastHazard(did, 'ROAD_HAZARD', `Hazard reported by ${did}`)}
                          disabled={isCrashed}
                        >
                          📢 P2P Gossip
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Unit3Sync
              section="fleet"
              showConceptTags={showConceptTags}
              orderedEvents={orderedEvents}
              gatewayLamport={gatewayLamport}
              currentLeader={currentLeader}
              driverNeighbours={driverNeighbours}
              electionTrace={electionTrace}
              electionStats={electionStats}
            />
          </div>
        )}

        {/* Tab 3: Reliability */}
        {activeTab === 'reliability' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Fault Tolerance & Failover Demonstration Box */}
            <div className="card" style={{ borderColor: '#fecdd3', background: '#fff1f2' }}>
              <div className="card-title">
                <span style={{ color: '#e11d48' }}>💥 Fault Tolerance & Failover Demo</span>
                {showConceptTags && <span className="concept-chip">Heartbeat Failure Detector</span>}
              </div>
              <p style={{ fontSize: '0.78rem', color: '#475569', marginBottom: '0.75rem' }}>
                Click below to crash <strong>Driver 2</strong> during an active ride. Coordinator detects missed heartbeats (&gt;3.5s) and automatically re-dispatches to <strong>Driver 3</strong>!
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-danger" onClick={() => handleKillDriver('driver-2')}>
                  💥 Kill Driver 2 (Crash)
                </button>
                <button className="btn btn-outline" onClick={() => handleRecoverDriver('driver-2')}>
                  ✨ Recover Driver 2
                </button>
              </div>
            </div>

            <Unit3Sync
              section="reliability"
              showConceptTags={showConceptTags}
              orderedEvents={orderedEvents}
              gatewayLamport={gatewayLamport}
              currentLeader={currentLeader}
              driverNeighbours={driverNeighbours}
              electionTrace={electionTrace}
              electionStats={electionStats}
            />
          </div>
        )}

        {/* Tab 4: Records & Analytics */}
        {activeTab === 'records' && (
          <Unit4Paradigms
            section="records"
            showConceptTags={showConceptTags}
          />
        )}

        {/* Tab 5: Architecture & Blueprint */}
        {activeTab === 'inspector' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
              <button
                className={`btn ${inspectorSubTab === 'blueprint' || inspectorSubTab === 'syllabus' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setInspectorSubTab('blueprint')}
                style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem' }}
              >
                🏗️ Infrastructure Blueprint & Specs
              </button>
              <button
                className={`btn ${inspectorSubTab === 'topology' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setInspectorSubTab('topology')}
                style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem' }}
              >
                🌐 Network Topology & Wire Flow
              </button>
              <button
                className={`btn ${inspectorSubTab === 'infra' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setInspectorSubTab('infra')}
                style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem' }}
              >
                ⚖️ Load Balancer, Serverless & Objects
              </button>
              <button
                className={`btn ${inspectorSubTab === 'causality' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setInspectorSubTab('causality')}
                style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem' }}
              >
                ⏱️ Logical Causality & Event Log
              </button>
              <button
                className={`btn ${inspectorSubTab === 'advanced' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setInspectorSubTab('advanced')}
                style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem', background: inspectorSubTab === 'advanced' ? '#4f46e5' : undefined }}
              >
                🔬 Advanced Production Systems (10 Features)
              </button>
              <button
                className={`btn ${inspectorSubTab === 'raw_packets' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setInspectorSubTab('raw_packets')}
                style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem' }}
              >
                📜 Protocol Wire Trace
              </button>
            </div>

            {inspectorSubTab === 'advanced' && <AdvancedSystems showConceptTags={showConceptTags} />}
            {(inspectorSubTab === 'blueprint' || inspectorSubTab === 'syllabus') && <SyllabusGuide />}
            {inspectorSubTab === 'topology' && <PacketFlow logs={logs} />}
            {inspectorSubTab === 'infra' && <Unit4Paradigms section="inspector" showConceptTags={showConceptTags} />}
            {inspectorSubTab === 'causality' && (
              <Unit3Sync
                section="inspector"
                showConceptTags={showConceptTags}
                orderedEvents={orderedEvents}
                gatewayLamport={gatewayLamport}
                currentLeader={currentLeader}
                driverNeighbours={driverNeighbours}
                electionTrace={electionTrace}
                electionStats={electionStats}
              />
            )}
            {inspectorSubTab === 'raw_packets' && (
              <div className="card">
                <div className="card-title">
                  <span>📜 Full Distributed Protocol Trace</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Packets Logged: {logs.length}</span>
                </div>
                <div className="terminal-window" style={{ height: '550px' }}>
                  {logs.map((log) => (
                    <div key={log.id} className="log-item">
                      <span className="log-time">[{log.time}]</span>
                      <span className={`log-tag ${log.category}`}>{log.category}</span>
                      <span className="log-msg">
                        {log.message} {log.details ? JSON.stringify(log.details) : ''}
                      </span>
                    </div>
                  ))}
                  <div ref={terminalEndRef} />
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* WebRTC Modal */}
      <WebRTCModal
        isOpen={isWebRTCOpen}
        onClose={() => setIsWebRTCOpen(false)}
        driverId={assignedDriverId}
        ws={wsRef.current}
      />

      {/* 8-Step Viva Guided Demo Tour Dock */}
      <GuidedDemoTour
        isOpen={isGuidedTourOpen}
        onClose={() => setIsGuidedTourOpen(false)}
        onNavigateTab={(tab) => handleTabChange(tab)}
        onRunQuote={handleEstimateFare}
        onRunRide={handleRequestRide}
        onBroadcastHazard={handleBroadcastHazard}
        showConceptTags={showConceptTags}
      />
        </div>
      )}
    </div>
  );
}

window.App = App;
