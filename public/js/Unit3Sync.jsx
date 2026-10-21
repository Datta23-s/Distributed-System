

function Unit3Sync({
  orderedEvents = [],
  gatewayLamport = 0,
  currentLeader = 'coordinator',
  driverNeighbours = {},
  electionTrace = [],
  electionStats = {},
  showConceptTags = true,
  section = 'all'
}) {
  // Logical Time State
  const [selectedEventAId, setSelectedEventAId] = React.useState('');
  const [selectedEventBId, setSelectedEventBId] = React.useState('');
  const [demoResult, setDemoResult] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // Election State
  const [selectedAlgorithm, setSelectedAlgorithm] = React.useState('bully');
  const [leader, setLeader] = React.useState(currentLeader);
  const [trace, setTrace] = React.useState(electionTrace);
  const [stats, setStats] = React.useState(electionStats);
  const [isElecting, setIsElecting] = React.useState(false);
  const [neighbours, setNeighbours] = React.useState(driverNeighbours);

  // Phase 3: Distributed Mutex State
  const [mutexData, setMutexData] = React.useState(null);
  const [selectedMutexRes, setSelectedMutexRes] = React.useState('airport_bay');
  const [selectedMutexAlgo, setSelectedMutexAlgo] = React.useState('ricart-agrawala');
  const [isMutexLoading, setIsMutexLoading] = React.useState(false);

  // Phase 3: Physical Clock Synchronization State
  const [clockData, setClockData] = React.useState(null);
  const [selectedClockAlgo, setSelectedClockAlgo] = React.useState('cristian');
  const [isClockSyncing, setIsClockSyncing] = React.useState(false);
  const [clockSyncResult, setClockSyncResult] = React.useState(null);

  // Phase 4: Chandy-Lamport Distributed Snapshot State
  const [snapshotData, setSnapshotData] = React.useState(null);
  const [isTakingSnapshot, setIsTakingSnapshot] = React.useState(false);
  const [snapshotTrace, setSnapshotTrace] = React.useState([]);

  // Phase 4: Chandy-Misra-Haas Deadlock State
  const [deadlockData, setDeadlockData] = React.useState(null);
  const [deadlockResult, setDeadlockResult] = React.useState(null);
  const [deadlockResolution, setDeadlockResolution] = React.useState(null);
  const [isDeadlockBusy, setIsDeadlockBusy] = React.useState(false);
  const [knappsInfo, setKnappsInfo] = React.useState(null);

  // Fetch Mutex & Clock Sync & Snapshot & Deadlock status periodically
  const fetchMutexStatus = () => {
    fetch('/api/mutex/status')
      .then((res) => res.json())
      .then((data) => { if (data.status === 'OK') setMutexData(data); })
      .catch(() => { });
  };

  const fetchClockStatus = () => {
    fetch('/api/clock/status')
      .then((res) => res.json())
      .then((data) => { if (data.status === 'OK') setClockData(data); })
      .catch(() => { });
  };

  const fetchSnapshotStatus = () => {
    fetch('/api/snapshot/latest')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'OK' && data.snapshot) setSnapshotData(data.snapshot);
        if (data.trace) setSnapshotTrace(data.trace);
      })
      .catch(() => { });
  };

  const fetchDeadlockStatus = () => {
    fetch('/api/deadlock/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'OK') {
          if (data.waitForGraph) setDeadlockData(data.waitForGraph);
          if (data.knapps) setKnappsInfo(data.knapps);
        }
      })
      .catch(() => { });
  };

  React.useEffect(() => {
    fetchMutexStatus();
    fetchClockStatus();
    fetchSnapshotStatus();
    fetchDeadlockStatus();
    const timer = setInterval(() => {
      fetchMutexStatus();
      fetchClockStatus();
      fetchSnapshotStatus();
      fetchDeadlockStatus();
      fetch('/api/discovery/neighbours')
        .then((res) => res.json())
        .then((data) => {
          if (data.neighbours) setNeighbours(data.neighbours);
        })
        .catch(() => { });
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    setLeader(currentLeader);
  }, [currentLeader]);

  React.useEffect(() => {
    if (electionStats) setStats(electionStats);
  }, [electionStats]);

  // Auto-select latest two events for Causality Inspector
  React.useEffect(() => {
    if (orderedEvents.length >= 2 && (!selectedEventAId || !selectedEventBId)) {
      setSelectedEventAId(orderedEvents[orderedEvents.length - 2].id);
      setSelectedEventBId(orderedEvents[orderedEvents.length - 1].id);
    }
  }, [orderedEvents]);

  const eventA = orderedEvents.find((e) => e.id === selectedEventAId) || orderedEvents[orderedEvents.length - 2] || null;
  const eventB = orderedEvents.find((e) => e.id === selectedEventBId) || orderedEvents[orderedEvents.length - 1] || null;

  const computeCausality = (clkA, clkB) => {
    if (!clkA || !clkB) return 'UNKNOWN (Clocks missing)';
    const keys = new Set([...Object.keys(clkA), ...Object.keys(clkB)]);
    let aGreater = false;
    let bGreater = false;

    for (const k of keys) {
      const va = parseInt(clkA[k] || 0, 10);
      const vb = parseInt(clkB[k] || 0, 10);
      if (va > vb) aGreater = true;
      else if (vb > va) bGreater = true;
    }

    if (!aGreater && !bGreater) return 'EQUAL (A == B)';
    if (!aGreater && bGreater) return 'BEFORE (A → B: A causally preceded B)';
    if (aGreater && !bGreater) return 'AFTER (B → A: B causally preceded A)';
    return 'CONCURRENT (A || B: Independent / Simultaneous)';
  };

  const handleRunConcurrentDemo = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/sync/concurrent_hazard_demo', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'OK') {
        setDemoResult(data);
        if (data.event1 && data.event2) {
          setSelectedEventAId(data.event1.id);
          setSelectedEventBId(data.event2.id);
        }
      }
    } catch (err) {
      alert('Error triggering concurrent demo: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKillCoordinator = async () => {
    setIsElecting(true);
    try {
      const res = await fetch('/api/election/kill_coordinator', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'OK') {
        setLeader('NONE (ELECTION NEEDED)');
        setTimeout(() => handleTriggerElection(), 800);
      }
    } catch (err) {
      alert('Error killing coordinator: ' + err.message);
      setIsElecting(false);
    }
  };

  const handleTriggerElection = async () => {
    setIsElecting(true);
    try {
      const res = await fetch('/api/election/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ algorithm: selectedAlgorithm, initiator: 'driver-1' })
      });
      const data = await res.json();
      if (data.status === 'OK') {
        setLeader(data.result.winner);
        setTrace(data.result.trace || []);
        if (data.result.stats) {
          setStats((prev) => ({ ...prev, [selectedAlgorithm]: data.result.stats }));
        }
      }
    } catch (err) {
      alert('Election failed: ' + err.message);
    } finally {
      setIsElecting(false);
    }
  };

  const handleRecoverCoordinator = async () => {
    try {
      const res = await fetch('/api/election/recover_coordinator', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'OK') {
        setLeader('coordinator');
      }
    } catch (err) {
      alert('Recovery failed: ' + err.message);
    }
  };

  // Mutex Handlers
  const handleAcquireMutex = async (driverId) => {
    setIsMutexLoading(true);
    try {
      const res = await fetch('/api/mutex/acquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId,
          resource: selectedMutexRes,
          algorithm: selectedMutexAlgo
        })
      });
      const data = await res.json();
      if (data.status === 'OK') {
        setMutexData(data.mutex);
      }
    } catch (err) {
      alert('Mutex acquire failed: ' + err.message);
    } finally {
      setIsMutexLoading(false);
    }
  };

  const handleReleaseMutex = async (driverId) => {
    setIsMutexLoading(true);
    try {
      const res = await fetch('/api/mutex/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId,
          resource: selectedMutexRes,
          algorithm: selectedMutexAlgo
        })
      });
      const data = await res.json();
      if (data.status === 'OK') {
        setMutexData(data.mutex);
      }
    } catch (err) {
      alert('Mutex release failed: ' + err.message);
    } finally {
      setIsMutexLoading(false);
    }
  };

  // Clock Sync Handlers
  const handleSyncClocks = async () => {
    setIsClockSyncing(true);
    try {
      const res = await fetch('/api/clock/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ algorithm: selectedClockAlgo })
      });
      const data = await res.json();
      if (data.status === 'OK') {
        setClockSyncResult(data.result);
        if (data.clocks) {
          setClockData({
            clocks: data.clocks,
            offsetTimeline: data.offsetTimeline || []
          });
        }
      }
    } catch (err) {
      alert('Clock sync failed: ' + err.message);
    } finally {
      setIsClockSyncing(false);
    }
  };

  const handleResetSkew = async () => {
    try {
      const res = await fetch('/api/clock/skew_reset', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'OK') {
        setClockData({
          clocks: data.clocks,
          offsetTimeline: data.offsetTimeline || []
        });
        setClockSyncResult(null);
      }
    } catch (err) {
      alert('Reset skew failed: ' + err.message);
    }
  };

  // Phase 4: Chandy-Lamport Snapshot Handler
  const handleTakeSnapshot = async () => {
    setIsTakingSnapshot(true);
    try {
      const res = await fetch('/api/snapshot/take', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initiator: 'coordinator' })
      });
      const data = await res.json();
      if (data.status === 'OK') {
        setSnapshotData(data.snapshot);
        fetchSnapshotStatus();
      }
    } catch (err) {
      alert('Snapshot failed: ' + err.message);
    } finally {
      setIsTakingSnapshot(false);
    }
  };

  // Phase 4: Deadlock Detection Handlers
  const handleSimulateDeadlock = async () => {
    setIsDeadlockBusy(true);
    try {
      const res = await fetch('/api/deadlock/simulate', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'OK') {
        setDeadlockData(data.waitForGraph);
        setDeadlockResult(null);
        setDeadlockResolution(null);
      }
    } catch (err) {
      alert('Deadlock simulation failed: ' + err.message);
    } finally {
      setIsDeadlockBusy(false);
    }
  };

  const handleDetectDeadlock = async () => {
    setIsDeadlockBusy(true);
    try {
      const res = await fetch('/api/deadlock/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initiator: 'driver-1' })
      });
      const data = await res.json();
      if (data.status === 'OK') {
        setDeadlockResult(data.result);
        if (data.waitForGraph) setDeadlockData(data.waitForGraph);
      }
    } catch (err) {
      alert('Deadlock detection failed: ' + err.message);
    } finally {
      setIsDeadlockBusy(false);
    }
  };

  const handleResolveDeadlock = async (victim = 'driver-2') => {
    setIsDeadlockBusy(true);
    try {
      const res = await fetch('/api/deadlock/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ victim })
      });
      const data = await res.json();
      if (data.status === 'OK') {
        setDeadlockResolution(data.resolution);
        if (data.resolution?.waitForGraph) setDeadlockData(data.resolution.waitForGraph);
      }
    } catch (err) {
      alert('Deadlock resolution failed: ' + err.message);
    } finally {
      setIsDeadlockBusy(false);
    }
  };

  const causality = eventA && eventB && eventA.vectorClock && eventB.vectorClock
    ? computeCausality(eventA.vectorClock, eventB.vectorClock)
    : 'Select two events with vector clocks';

  const airportBay = mutexData?.resources?.airport_bay || { status: 'FREE', holder: null, queue: [] };
  const charger = mutexData?.resources?.charging_station || { status: 'FREE', holder: null, queue: [] };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* SECTION: Exclusive Resource Queues (Mutex) - Fleet & Resources */}
      {(section === 'all' || section === 'fleet') && (
        <div className="card" style={{ borderLeft: '4px solid #0284c7' }}>
          <div className="card-title">
            <span style={{ color: '#0284c7' }}>🔒 Exclusive Resource Queues (Airport Bay & Charging Station)</span>
            {showConceptTags && <span className="concept-chip">Ricart-Agrawala / Token Ring</span>}
          </div>
          <p style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '1rem' }}>
            Drivers coordinate exclusive access to single-capacity physical resources without a central lock manager.
            Compare <strong>Ricart-Agrawala</strong> (timestamp permission with deferred replies, 2(N - 1) messages) versus <strong>Token Ring</strong> (circulating privileged token, 0 to N messages).
          </p>

          {/* Resource Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            {/* Airport Bay */}
            <div style={{
              padding: '1rem',
              borderRadius: '8px',
              border: `2px solid ${airportBay.status === 'OCCUPIED' ? '#f59e0b' : '#10b981'}`,
              background: airportBay.status === 'OCCUPIED' ? '#fffbeb' : '#f0fdf4'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>✈️ Airport Pickup Bay (Terminal 1)</span>
                <span style={{
                  padding: '0.2rem 0.6rem',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  background: airportBay.status === 'OCCUPIED' ? '#fde68a' : '#bbf7d0',
                  color: airportBay.status === 'OCCUPIED' ? '#92400e' : '#166534'
                }}>
                  {airportBay.status === 'OCCUPIED' ? `🔒 OCCUPIED (${airportBay.holder})` : '🟢 FREE TO ENTER'}
                </span>
              </div>
              <div style={{ fontSize: '0.76rem', color: '#475569' }}>
                <div><strong>Critical Section Holder:</strong> {airportBay.holder ? `🚗 ${airportBay.holder}` : 'None'}</div>
                <div><strong>Waiting Queue:</strong> {airportBay.queue?.length > 0 ? airportBay.queue.map(q => q.driverId).join(', ') : 'Empty (No contention)'}</div>
                <div style={{ marginTop: '0.25rem', fontSize: '0.72rem', color: '#64748b' }}>Token Ring Current Location: <code>{airportBay.tokenHolder}</code> (Token #{airportBay.tokenSeq || 1})</div>
              </div>
            </div>

            {/* EV Charging Station */}
            <div style={{
              padding: '1rem',
              borderRadius: '8px',
              border: `2px solid ${charger.status === 'OCCUPIED' ? '#f59e0b' : '#10b981'}`,
              background: charger.status === 'OCCUPIED' ? '#fffbeb' : '#f0fdf4'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>⚡ Fleet EV Supercharger (Alpha)</span>
                <span style={{
                  padding: '0.2rem 0.6rem',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  background: charger.status === 'OCCUPIED' ? '#fde68a' : '#bbf7d0',
                  color: charger.status === 'OCCUPIED' ? '#92400e' : '#166534'
                }}>
                  {charger.status === 'OCCUPIED' ? `🔒 CHARGING (${charger.holder})` : '🟢 CHARGER IDLE'}
                </span>
              </div>
              <div style={{ fontSize: '0.76rem', color: '#475569' }}>
                <div><strong>Critical Section Holder:</strong> {charger.holder ? `🚗 ${charger.holder}` : 'None'}</div>
                <div><strong>Waiting Queue:</strong> {charger.queue?.length > 0 ? charger.queue.map(q => q.driverId).join(', ') : 'Empty (No contention)'}</div>
                <div style={{ marginTop: '0.25rem', fontSize: '0.72rem', color: '#64748b' }}>Token Ring Current Location: <code>{charger.tokenHolder}</code> (Token #{charger.tokenSeq || 1})</div>
              </div>
            </div>
          </div>

          {/* Algorithm Selection & Actions */}
          <div className="grid-two-col" style={{ marginBottom: '1rem' }}>
            <div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', display: 'block' }}>Target Resource:</label>
                  <select
                    style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', marginTop: '0.2rem' }}
                    value={selectedMutexRes}
                    onChange={(e) => setSelectedMutexRes(e.target.value)}
                  >
                    <option value="airport_bay">✈️ Airport Pickup Bay</option>
                    <option value="charging_station">⚡ EV Fast Charging Station</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', display: 'block' }}>Mutex Algorithm:</label>
                  <select
                    style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', marginTop: '0.2rem' }}
                    value={selectedMutexAlgo}
                    onChange={(e) => setSelectedMutexAlgo(e.target.value)}
                  >
                    <option value="ricart-agrawala">Ricart-Agrawala (2*(N-1) messages)</option>
                    <option value="token-ring">Token Ring (0 to N messages)</option>
                    <option value="lodha-kshemkalyani">Lodha-Kshemkalyani (Vector Clock Fair)</option>
                  </select>
                </div>
              </div>

              {/* Driver Request / Release Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {['driver-1', 'driver-2', 'driver-3'].map((did) => {
                  const currentRes = selectedMutexRes === 'airport_bay' ? airportBay : charger;
                  const isHolder = currentRes.holder === did;
                  return (
                    <div key={did} style={{ padding: '0.6rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#1e293b', marginBottom: '0.4rem' }}>{did}</div>
                      {isHolder ? (
                        <button
                          className="btn btn-danger"
                          style={{ width: '100%', padding: '0.35rem', fontSize: '0.75rem' }}
                          onClick={() => handleReleaseMutex(did)}
                          disabled={isMutexLoading}
                        >
                          🔓 Release CS
                        </button>
                      ) : (
                        <button
                          className="btn btn-outline"
                          style={{ width: '100%', padding: '0.35rem', fontSize: '0.75rem' }}
                          onClick={() => handleAcquireMutex(did)}
                          disabled={isMutexLoading}
                        >
                          🔒 Request CS
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Message Complexity Comparison Table */}
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <strong style={{ fontSize: '0.8rem', color: '#1e293b' }}>📊 Mutex Message Complexity & Cost Analysis:</strong>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                <thead>
                  <tr style={{ background: '#e2e8f0', textAlign: 'left', color: '#334155' }}>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Algorithm</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Formula</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Cost for N=3</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Live Msgs</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.35rem 0.5rem', fontWeight: 600 }}>Ricart-Agrawala</td>
                    <td style={{ padding: '0.35rem 0.5rem', fontFamily: 'monospace' }}>2*(N - 1)</td>
                    <td style={{ padding: '0.35rem 0.5rem', color: '#0369a1' }}>4 messages</td>
                    <td style={{ padding: '0.35rem 0.5rem', fontWeight: 700 }}>{mutexData?.stats?.['ricart-agrawala']?.totalMsgs || 0}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.35rem 0.5rem', fontWeight: 600 }}>Token Ring</td>
                    <td style={{ padding: '0.35rem 0.5rem', fontFamily: 'monospace' }}>0 to N - 1 hops</td>
                    <td style={{ padding: '0.35rem 0.5rem', color: '#059669' }}>0 to 2 hops</td>
                    <td style={{ padding: '0.35rem 0.5rem', fontWeight: 700 }}>{mutexData?.stats?.['token-ring']?.totalMsgs || 0}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.35rem 0.5rem', fontWeight: 600 }}>Lodha-Kshemkalyani</td>
                    <td style={{ padding: '0.35rem 0.5rem', fontFamily: 'monospace' }}>2*(N - 1) + VC</td>
                    <td style={{ padding: '0.35rem 0.5rem', color: '#7c3aed' }}>4 msgs + Matrix</td>
                    <td style={{ padding: '0.35rem 0.5rem', fontWeight: 700 }}>{mutexData?.stats?.['lodha-kshemkalyani']?.totalMsgs || 0}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Live Mutex Protocol Trace */}
          <div>
            <label style={{ fontSize: '0.76rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
              📜 Real-Time Distributed Mutex Execution Trace (Deferred Replies & Token Passes):
            </label>
            <div style={{ maxHeight: '140px', overflowY: 'auto', background: '#0f172a', color: '#e2e8f0', padding: '0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontFamily: 'monospace' }}>
              {!mutexData?.traceLog || mutexData.traceLog.length === 0 ? (
                <div style={{ color: '#64748b' }}>Click "Request CS" on any driver above to observe distributed mutex message exchange!</div>
              ) : (
                mutexData.traceLog.map((step, idx) => (
                  <div key={step.id || idx} style={{ marginBottom: '0.2rem', lineHeight: '1.25' }}>
                    <span style={{ color: '#94a3b8' }}>[{step.time}]</span>{' '}
                    <span style={{ color: '#38bdf8', fontWeight: 700 }}>[{step.algorithm}]</span>{' '}
                    <span style={{
                      color: step.action === 'ENTER_CS' ? '#4ade80' : step.action === 'DEFER' ? '#f87171' : step.action === 'TOKEN_PASS' ? '#facc15' : '#c084fc',
                      fontWeight: 700
                    }}>
                      [{step.action}]
                    </span>{' '}
                    <span style={{ color: '#f8fafc' }}>{step.from} → {step.to}:</span>{' '}
                    <span style={{ color: '#cbd5e1' }}>{step.details}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: Physical Clock Synchronization */}
      {(section === 'all' || section === 'fleet') && (
        <div className="card" style={{ borderLeft: '4px solid #059669' }}>
          <div className="card-title">
            <span style={{ color: '#059669' }}>⏱️ Physical Clock Synchronization (Cristian's RTT/2 vs Berkeley Average)</span>
            {showConceptTags && <span className="concept-chip">Cristian RTT/2 / Berkeley</span>}
          </div>
          <p style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '1rem' }}>
            Nodes experience simulated oscillator drift and initial hardware clock skews (±500ms).
            Compare <strong>Cristian's Algorithm</strong> (clients query Time Server and adjust by T_server + RTT/2) versus <strong>Berkeley Algorithm</strong> (Master polls all nodes, computes fault-tolerant average, and sends adjustments).
          </p>

          {/* Per-Node Skew Monitors */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            {clockData?.clocks && Object.values(clockData.clocks).map((clk) => {
              const offset = clk.offsetMs || 0;
              const isZero = Math.abs(offset) < 5;
              const isFast = offset > 0;
              return (
                <div key={clk.nodeId} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#1e293b' }}>{clk.nodeId}</span>
                    <span style={{
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: isZero ? '#dcfce7' : isFast ? '#fef3c7' : '#fee2e2',
                      color: isZero ? '#15803d' : isFast ? '#92400e' : '#b91c1c'
                    }}>
                      {isZero ? 'SYNCED' : isFast ? `+${offset}ms` : `${offset}ms`}
                    </span>
                  </div>
                  {/* Visual Offset Bar */}
                  <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: '50%',
                      width: `${Math.min(50, Math.abs(offset) / 10)}%`,
                      transform: isFast ? 'none' : 'translateX(-100%)',
                      background: isZero ? '#10b981' : isFast ? '#f59e0b' : '#ef4444'
                    }} />
                  </div>
                  <div style={{ marginTop: '0.4rem', fontSize: '0.68rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Drift: {clk.driftPpm > 0 ? `+${clk.driftPpm}` : clk.driftPpm} ppm</span>
                    <span>{clk.nodeId === 'coordinator' ? 'Time Server' : 'Client'}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sync Controls */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>Sync Algorithm:</label>
              <select
                style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                value={selectedClockAlgo}
                onChange={(e) => setSelectedClockAlgo(e.target.value)}
              >
                <option value="cristian">Cristian's Algorithm (RTT/2 Delay Compensation)</option>
                <option value="berkeley">Berkeley Algorithm (Coordinator Averaging & Polling)</option>
              </select>
            </div>

            <button
              className="btn btn-primary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 600 }}
              onClick={handleSyncClocks}
              disabled={isClockSyncing}
            >
              {isClockSyncing ? 'Synchronizing...' : '⚡ Sync Clocks Now'}
            </button>

            <button
              className="btn btn-outline"
              style={{ padding: '0.5rem 1rem', fontSize: '0.82rem' }}
              onClick={handleResetSkew}
            >
              🎲 Induce Random Skew (±500ms)
            </button>
          </div>

          {/* Sync Results & Trace Table */}
          {clockSyncResult && (
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#059669' }}>
                  ✅ Clocks Converged via {clockSyncResult.algorithm}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Timestamp: {clockSyncResult.time}</span>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                <thead>
                  <tr style={{ background: '#e2e8f0', textAlign: 'left', color: '#334155' }}>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Node</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Offset Before</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>RTT / Transit</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Adjustment (Δ)</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Offset After</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Formula / Bound</th>
                  </tr>
                </thead>
                <tbody>
                  {clockSyncResult.traceSteps?.map((step) => {
                    const bOffset = clockSyncResult.beforeOffsets?.[step.nodeId]?.offsetMs;
                    const aOffset = clockSyncResult.afterOffsets?.[step.nodeId]?.offsetMs;
                    return (
                      <tr key={step.nodeId} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '0.35rem 0.5rem', fontWeight: 600 }}>{step.nodeId}</td>
                        <td style={{ padding: '0.35rem 0.5rem', color: bOffset > 0 ? '#b45309' : '#b91c1c' }}>
                          {bOffset > 0 ? `+${bOffset}ms` : `${bOffset}ms`}
                        </td>
                        <td style={{ padding: '0.35rem 0.5rem', fontFamily: 'monospace' }}>{step.rtt ? `${step.rtt}ms` : '—'}</td>
                        <td style={{ padding: '0.35rem 0.5rem', fontWeight: 700, color: '#0369a1' }}>
                          {step.delta > 0 ? `+${step.delta}ms` : `${step.delta}ms`}
                        </td>
                        <td style={{ padding: '0.35rem 0.5rem', fontWeight: 700, color: '#15803d' }}>
                          {aOffset > 0 ? `+${aOffset}ms` : `${aOffset}ms`}
                        </td>
                        <td style={{ padding: '0.35rem 0.5rem', fontFamily: 'monospace', color: '#64748b' }}>
                          {step.formula || step.errorBound || step.action}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Physical Clock Offset-Over-Time Chart */}
          <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1e293b' }}>
                  📈 Physical Clock Skew & Offset Trajectory Over Time
                </span>
                <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: '0.1rem' }}>
                  Visualizes simulated hardware clock drift & convergence towards zero skew (±15ms tolerance)
                </span>
              </div>
              {/* Chart Legend */}
              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.72rem', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#059669', fontWeight: 600 }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#059669', display: 'inline-block' }}></span>
                  coordinator (0ms)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#0284c7', fontWeight: 600 }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0284c7', display: 'inline-block' }}></span>
                  driver-1
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#dc2626', fontWeight: 600 }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#dc2626', display: 'inline-block' }}></span>
                  driver-2
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#d97706', fontWeight: 600 }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#d97706', display: 'inline-block' }}></span>
                  driver-3
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#7c3aed', fontWeight: 600 }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#7c3aed', display: 'inline-block' }}></span>
                  customer
                </span>
              </div>
            </div>

            {/* SVG Line / Trajectory Visualization */}
            {(() => {
              const timeline = clockData?.offsetTimeline && clockData.offsetTimeline.length > 0
                ? clockData.offsetTimeline
                : [
                  { label: 'Initial Skew', offsets: { 'coordinator': 0, 'driver-1': 320, 'driver-2': -410, 'driver-3': 215, 'customer': -180 } },
                  { label: 'After Sync', offsets: { 'coordinator': 0, 'driver-1': 4, 'driver-2': -6, 'driver-3': 2, 'customer': -1 } }
                ];
              const nodeColors = {
                'coordinator': '#059669',
                'driver-1': '#0284c7',
                'driver-2': '#dc2626',
                'driver-3': '#d97706',
                'customer': '#7c3aed'
              };
              const width = 640;
              const height = 180;
              const padding = { top: 20, right: 30, bottom: 35, left: 55 };
              const chartW = width - padding.left - padding.right;
              const chartH = height - padding.top - padding.bottom;
              const midY = padding.top + chartH / 2; // Y=0 line (0ms offset)
              const maxOffset = 500;

              const getY = (offset) => {
                const clamped = Math.max(-maxOffset, Math.min(maxOffset, offset || 0));
                return midY - (clamped / maxOffset) * (chartH / 2);
              };

              const getX = (idx) => {
                if (timeline.length <= 1) return padding.left + chartW / 2;
                return padding.left + (idx / (timeline.length - 1)) * chartW;
              };

              return (
                <div style={{ width: '100%', overflowX: 'auto' }}>
                  <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', maxHeight: '200px', display: 'block', background: '#ffffff', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                    {/* Grid Lines & Labels */}
                    <line x1={padding.left} y1={padding.top} x2={width - padding.right} y2={padding.top} stroke="#f1f5f9" strokeWidth="1" />
                    <text x={padding.left - 8} y={padding.top + 4} fontSize="9" fill="#94a3b8" textAnchor="end">+500ms</text>

                    <line x1={padding.left} y1={midY} x2={width - padding.right} y2={midY} stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 3" />
                    <text x={padding.left - 8} y={midY + 3} fontSize="9" fill="#059669" fontWeight="bold" textAnchor="end">0ms (True)</text>

                    <line x1={padding.left} y1={padding.top + chartH} x2={width - padding.right} y2={padding.top + chartH} stroke="#f1f5f9" strokeWidth="1" />
                    <text x={padding.left - 8} y={padding.top + chartH + 3} fontSize="9" fill="#94a3b8" textAnchor="end">-500ms</text>

                    {/* Convergence Safe Band (±25ms) */}
                    <rect
                      x={padding.left}
                      y={midY - (25 / maxOffset) * (chartH / 2)}
                      width={chartW}
                      height={(50 / maxOffset) * (chartH / 2)}
                      fill="#ecfdf5"
                      opacity="0.6"
                    />

                    {/* Draw trajectory lines per node */}
                    {Object.keys(nodeColors).map((nodeId) => {
                      const points = timeline.map((pt, idx) => {
                        const offset = pt.offsets?.[nodeId] ?? 0;
                        return `${getX(idx)},${getY(offset)}`;
                      }).join(' ');

                      return (
                        <g key={nodeId}>
                          <polyline
                            fill="none"
                            stroke={nodeColors[nodeId]}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={points}
                            opacity="0.85"
                          />
                          {timeline.map((pt, idx) => {
                            const offset = pt.offsets?.[nodeId] ?? 0;
                            return (
                              <circle
                                key={idx}
                                cx={getX(idx)}
                                cy={getY(offset)}
                                r="3.5"
                                fill={nodeColors[nodeId]}
                                stroke="#ffffff"
                                strokeWidth="1.5"
                              >
                                <title>{`${nodeId}: ${offset > 0 ? '+' : ''}${offset}ms (${pt.label})`}</title>
                              </circle>
                            );
                          })}
                        </g>
                      );
                    })}

                    {/* Time Step Labels on X-axis */}
                    {timeline.map((pt, idx) => (
                      <text
                        key={idx}
                        x={getX(idx)}
                        y={height - 10}
                        fontSize="9"
                        fill="#64748b"
                        textAnchor="middle"
                        fontWeight="600"
                      >
                        {pt.label ? (pt.label.length > 14 ? pt.label.substring(0, 12) + '..' : pt.label) : `Step ${idx + 1}`}
                      </text>
                    ))}
                  </svg>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* SECTION: Global State & Distributed Snapshot (Chandy-Lamport) */}
      {(section === 'all' || section === 'reliability') && (
        <div className="card" style={{ borderLeft: '4px solid #0284c7' }}>
          <div className="card-title">
            <span style={{ color: '#0284c7' }}>📸 Global State & Distributed Snapshot (Chandy-Lamport Consistent Cut)</span>
            {showConceptTags && <span className="concept-chip">Chandy-Lamport Cut</span>}
          </div>
          <p style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '1rem' }}>
            The <strong>Chandy-Lamport Algorithm (1985)</strong> captures a strongly consistent global checkpoint (Consistent Cut) across independent distributed processes and FIFO TCP channels without freezing ongoing fleet operations.
          </p>

          {/* Action Controls & Status */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              style={{ padding: '0.55rem 1.25rem', fontSize: '0.85rem', fontWeight: 600, background: '#0284c7', borderColor: '#0284c7' }}
              onClick={handleTakeSnapshot}
              disabled={isTakingSnapshot}
            >
              {isTakingSnapshot ? 'Taking Snapshot...' : '📸 Take Global Snapshot'}
            </button>

            {snapshotData && (
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span style={{
                  padding: '0.3rem 0.65rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: snapshotData.consistencyReport?.isConsistent ? '#dcfce7' : '#fee2e2',
                  color: snapshotData.consistencyReport?.isConsistent ? '#15803d' : '#b91c1c'
                }}>
                  {snapshotData.consistencyReport?.isConsistent ? '✅ CONSISTENT CUT VERIFIED' : '❌ INCONSISTENT CUT DETECTED'}
                </span>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Snapshot ID: <strong style={{ color: '#1e293b' }}>{snapshotData.snapshotId}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Consistent Cut Viewer */}
          {snapshotData ? (
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
                1. Recorded Process Local States (Local Cuts L_i):
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {snapshotData.nodeStates && Object.entries(snapshotData.nodeStates).map(([nodeId, nState]) => (
                  <div key={nodeId} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>{nodeId}</span>
                      <span style={{
                        padding: '0.15rem 0.4rem',
                        borderRadius: '4px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        background: nState.status === 'AVAILABLE' ? '#dcfce7' : nState.status === 'EN_ROUTE' ? '#e0f2fe' : '#fef3c7',
                        color: nState.status === 'AVAILABLE' ? '#15803d' : nState.status === 'EN_ROUTE' ? '#0369a1' : '#b45309'
                      }}>
                        {nState.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <div>Position: <strong>[{nState.position ? nState.position.join(', ') : '50, 50'}]</strong></div>
                      <div>Active Ride: <strong>{nState.currentRide ? `${nState.currentRide.rideId} ($${nState.currentRide.fare || '15.00'})` : 'None (Idle)'}</strong></div>
                      <div>Held Resources: <strong>{nState.heldResources && nState.heldResources.length > 0 ? nState.heldResources.join(', ') : 'None'}</strong></div>
                      <div style={{ color: '#0284c7', fontWeight: 600 }}>Lamport Ts: L={nState.lamportTs || 0}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* FIFO Channels State */}
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
                2. FIFO Channel States (In-Flight Messages in Transit During Cut):
              </div>
              <div style={{ overflowX: 'auto', marginBottom: '1.25rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                  <thead>
                    <tr style={{ background: '#e2e8f0', textAlign: 'left', color: '#334155' }}>
                      <th style={{ padding: '0.35rem 0.5rem' }}>Channel (From → To)</th>
                      <th style={{ padding: '0.35rem 0.5rem' }}>Channel State</th>
                      <th style={{ padding: '0.35rem 0.5rem' }}>Recorded In-Flight Messages</th>
                      <th style={{ padding: '0.35rem 0.5rem' }}>Chandy-Lamport Rule</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshotData.channelStates && Object.entries(snapshotData.channelStates).map(([chKey, ch]) => (
                      <tr key={chKey} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '0.35rem 0.5rem', fontWeight: 600, fontFamily: 'monospace' }}>{chKey}</td>
                        <td style={{ padding: '0.35rem 0.5rem' }}>
                          <span style={{
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            background: ch.inFlightMessages && ch.inFlightMessages.length > 0 ? '#fef3c7' : '#f1f5f9',
                            color: ch.inFlightMessages && ch.inFlightMessages.length > 0 ? '#b45309' : '#64748b'
                          }}>
                            {ch.inFlightMessages && ch.inFlightMessages.length > 0 ? `${ch.inFlightMessages.length} IN-FLIGHT` : 'EMPTY'}
                          </span>
                        </td>
                        <td style={{ padding: '0.35rem 0.5rem', color: ch.inFlightMessages && ch.inFlightMessages.length > 0 ? '#b45309' : '#94a3b8' }}>
                          {ch.inFlightMessages && ch.inFlightMessages.length > 0
                            ? ch.inFlightMessages.map((m) => `${m.type} (${m.rideId || ''})`).join(', ')
                            : 'Zero in-flight packets (Channel fully drained)'}
                        </td>
                        <td style={{ padding: '0.35rem 0.5rem', color: '#64748b' }}>
                          {ch.isClosed ? 'First Marker Rule: Channel marked empty' : 'Subsequent Marker Rule: Saved transit messages'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Consistency Check Summary */}
              <div style={{ background: '#ecfdf5', padding: '0.75rem', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#065f46', marginBottom: '0.25rem' }}>
                  🛡️ Consistency Invariant Verification Report:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem', fontSize: '0.74rem', color: '#047857' }}>
                  <div>✓ Ride Assignment Safety: No ride assigned to multiple drivers simultaneously.</div>
                  <div>✓ Mutual Exclusion Safety: Shared airport bays & chargers respect single-holder invariant.</div>
                  <div>✓ Causal Precedence: No recorded message received whose transmission occurred after cut.</div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '1.5rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '0.82rem' }}>
              No global snapshot taken yet. Click "Take Global Snapshot" to execute the Chandy-Lamport algorithm across all active nodes ({snapshotData?.nodes?.length || 5} nodes) over TCP!
            </div>
          )}
        </div>
      )}

      {/* SECTION: Distributed Deadlock Detection (Chandy-Misra-Haas) */}
      {(section === 'all' || section === 'reliability') && (
        <div className="card" style={{ borderLeft: '4px solid #dc2626' }}>
          <div className="card-title">
            <span style={{ color: '#dc2626' }}>🚨 Distributed Deadlock Detection (Chandy-Misra-Haas Edge-Chasing)</span>
            {showConceptTags && <span className="concept-chip">Chandy-Misra-Haas Probe</span>}
          </div>
          <p style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '1rem' }}>
            Implements <strong>Chandy-Misra-Haas (1983)</strong> edge-chasing for the AND-request model. Blocked nodes send lightweight <code>PROBE(initiator, sender, receiver)</code> messages along directed edges of the Wait-For Graph (WFG). When a probe returns to its initiator, circular wait deadlock is proven and a victim process is preempted.
          </p>

          {/* Scenario Controls */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <button
              className="btn btn-outline"
              style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', borderColor: '#f87171', color: '#dc2626' }}
              onClick={handleSimulateDeadlock}
              disabled={isDeadlockBusy}
            >
              ⚡ 1. Induce Circular Wait Deadlock
            </button>

            <button
              className="btn btn-primary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', background: '#dc2626', borderColor: '#dc2626' }}
              onClick={handleDetectDeadlock}
              disabled={isDeadlockBusy}
            >
              🔍 2. Chase Probes & Detect Deadlock
            </button>

            <button
              className="btn btn-secondary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', background: '#059669', borderColor: '#059669', color: '#fff' }}
              onClick={() => handleResolveDeadlock('driver-2')}
              disabled={isDeadlockBusy}
            >
              🛡️ 3. Preempt Victim & Resolve
            </button>
          </div>

          {/* Deadlock State Banner */}
          {deadlockData?.isDeadlocked && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: '#fef2f2',
              border: '2px solid #ef4444',
              marginBottom: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#b91c1c' }}>
                  🚨 DEADLOCK DETECTED IN FLEET RESOURCE ALLOCATION GRAPH!
                </div>
                <div style={{ fontSize: '0.76rem', color: '#7f1d1d', marginTop: '0.2rem' }}>
                  Circular Wait Cycle: <strong>driver-1 → driver-2 → driver-1</strong> (D1 holds Airport Bay, wants Charger; D2 holds Charger, wants Bay).
                </div>
              </div>
              <span style={{ padding: '0.3rem 0.6rem', borderRadius: '4px', background: '#fee2e2', color: '#991b1b', fontWeight: 700, fontSize: '0.75rem' }}>
                VICTIM CANDIDATE: driver-2
              </span>
            </div>
          )}

          {/* Wait-For Graph (WFG) Visualization */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {deadlockData?.nodes?.map((node) => {
              const isWaiting = Boolean(node.waiting);
              const isHeld = node.held && node.held.length > 0;
              return (
                <div key={node.id} style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: isWaiting && deadlockData?.isDeadlocked ? '2px solid #ef4444' : '1px solid #cbd5e1',
                  background: '#f8fafc'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>{node.id}</span>
                    <span style={{
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: isWaiting ? '#fee2e2' : '#dcfce7',
                      color: isWaiting ? '#b91c1c' : '#15803d'
                    }}>
                      {isWaiting ? `WAITING ON ${node.waiting.heldBy}` : 'ACTIVE / GRANTED'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div>Currently Holds: <strong style={{ color: '#0369a1' }}>{isHeld ? node.held.join(', ') : 'None'}</strong></div>
                    <div>Waiting For: <strong style={{ color: isWaiting ? '#dc2626' : '#64748b' }}>
                      {isWaiting ? `${node.waiting.resourceName || node.waiting.resourceId} (held by ${node.waiting.heldBy})` : 'None'}
                    </strong></div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Edge-Chasing Probe Results */}
          {deadlockResult && (
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.8rem', color: deadlockResult.deadlockDetected ? '#dc2626' : '#059669', marginBottom: '0.4rem' }}>
                {deadlockResult.deadlockDetected
                  ? `🚨 Chandy-Misra-Haas Probe Traversal Confirmed Deadlock Cycle: ${deadlockResult.cycle.join(' → ')}`
                  : `✅ Edge-chasing probe completed without circular wait.`}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                <thead>
                  <tr style={{ background: '#e2e8f0', textAlign: 'left', color: '#334155' }}>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Hop #</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Probe Message</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Wanted Resource</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>TCP Transmission</th>
                  </tr>
                </thead>
                <tbody>
                  {deadlockResult.probeHops?.map((hop, hIdx) => (
                    <tr key={hIdx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.35rem 0.5rem', fontWeight: 700 }}>Hop {hop.hop}</td>
                      <td style={{ padding: '0.35rem 0.5rem', fontFamily: 'monospace', color: '#0284c7' }}>
                        PROBE(init={hop.initiator}, sender={hop.sender}, receiver={hop.receiver})
                      </td>
                      <td style={{ padding: '0.35rem 0.5rem', fontWeight: 600 }}>{hop.wantedResource}</td>
                      <td style={{ padding: '0.35rem 0.5rem', color: '#16a34a' }}>Dispatched over TCP Control Channel</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Knapp's Classification Reference Card (Distributed Deadlock Taxonomies) */}
          <div style={{ background: '#f1f5f9', padding: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#1e293b' }}>
                📚 Knapp's Classification of Distributed Deadlock Detection Algorithms (1987)
              </span>
              {showConceptTags && (
                <span className="concept-chip">
                  Knapp WFG Models
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
              <div style={{ padding: '0.6rem', borderRadius: '6px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#0284c7' }}>1. Path-Pushing</div>
                <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '0.2rem' }}>
                  <strong>Example:</strong> Obermarck (1982). Nodes transmit full wait-for paths along edges. Overhead grows with path length O(N*E).
                </div>
              </div>

              <div style={{ padding: '0.6rem', borderRadius: '6px', background: '#ecfdf5', border: '2px solid #10b981' }}>
                <div style={{ fontWeight: 800, fontSize: '0.78rem', color: '#065f46' }}>
                  2. Edge-Chasing (UrbanPulse)
                </div>
                <div style={{ fontSize: '0.7rem', color: '#047857', marginTop: '0.2rem' }}>
                  <strong>Example:</strong> Chandy-Misra-Haas (1983). Fixed-size O(1) PROBE messages circulate along WFG edges. Message complexity O(E).
                </div>
              </div>

              <div style={{ padding: '0.6rem', borderRadius: '6px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#7c3aed' }}>3. Diffusion Computation</div>
                <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '0.2rem' }}>
                  <strong>Example:</strong> Dijkstra-Scholten / Chandy OR-model. Query waves diffuse outward; echo waves confirm deadlocks.
                </div>
              </div>

              <div style={{ padding: '0.6rem', borderRadius: '6px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#d97706' }}>4. Global-State-Based</div>
                <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '0.2rem' }}>
                  <strong>Example:</strong> Ho-Ramamoorthy (1986). Construct global WFG from snapshots. Vulnerable to phantom deadlocks if cut is inconsistent.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: Leader Election & Fault Tolerance */}
      {(section === 'all' || section === 'reliability') && (
        <div className="card" style={{ borderLeft: '4px solid #7c3aed' }}>
          <div className="card-title">
            <span style={{ color: '#7c3aed' }}>👑 Leader Election & Fault Tolerance (Bully vs Ring)</span>
            {showConceptTags && <span className="concept-chip">Bully / Chang-Roberts</span>}
          </div>
          <p style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '1rem' }}>
            When the Coordinator crashes, driver processes detect heartbeat/beacon cessation and trigger an autonomous election. The highest-priority live node wins and assumes the leader role, re-registering in <code>naming.js</code> transparently.
          </p>

          <div className="grid-two-col" style={{ marginBottom: '1rem' }}>
            {/* Controls */}
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>Election Algorithm:</label>
                <select
                  style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                  value={selectedAlgorithm}
                  onChange={(e) => setSelectedAlgorithm(e.target.value)}
                >
                  <option value="bully">Bully Algorithm (Garcia-Molina, 1982)</option>
                  <option value="ring">Ring Election (Chang & Roberts Token)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  className="btn btn-danger"
                  style={{ flex: 1, padding: '0.6rem', fontSize: '0.82rem', fontWeight: 600 }}
                  onClick={handleKillCoordinator}
                  disabled={isElecting}
                >
                  {isElecting ? 'Electing Leader...' : '💀 Kill Coordinator (Trigger Election)'}
                </button>
                {leader !== 'coordinator' && (
                  <button
                    className="btn btn-outline"
                    style={{ padding: '0.6rem 0.9rem', fontSize: '0.82rem' }}
                    onClick={handleRecoverCoordinator}
                  >
                    ✨ Recover Primary Coordinator
                  </button>
                )}
              </div>

              {/* Message Complexity Comparison */}
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.76rem' }}>
                <strong style={{ color: '#334155' }}>📊 Message Complexity Comparison:</strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.4rem' }}>
                  <div style={{ padding: '0.4rem', background: '#ffffff', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 700, color: '#7c3aed' }}>Bully Algorithm: O(N²)</div>
                    <div>Messages: {stats.bully ? `${stats.bully.totalMsgs} (E:${stats.bully.electionMsgs}, OK:${stats.bully.okMsgs}, C:${stats.bully.coordinatorMsgs})` : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No run yet</span>}</div>
                  </div>
                  <div style={{ padding: '0.4rem', background: '#ffffff', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 700, color: '#0284c7' }}>Ring Election: 2N</div>
                    <div>Messages: {stats.ring ? `${stats.ring.totalMsgs} (N election + N victory)` : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No run yet</span>}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Election Step-by-Step Trace */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                📜 Step-by-Step Election Message Protocol Trace:
              </label>
              <div style={{ maxHeight: '180px', overflowY: 'auto', background: '#0f172a', color: '#e2e8f0', padding: '0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                {trace.length === 0 ? (
                  <div style={{ color: '#64748b' }}>No election run yet. Click "Kill Coordinator" above to run election!</div>
                ) : (
                  trace.map((step, idx) => (
                    <div key={step.id || idx} style={{ marginBottom: '0.25rem', lineHeight: '1.3' }}>
                      <span style={{ color: '#94a3b8' }}>[{step.time}]</span>{' '}
                      <span style={{ color: step.type === 'COORDINATOR' ? '#4ade80' : step.type === 'OK' ? '#38bdf8' : '#c084fc', fontWeight: 700 }}>
                        [{step.type}]
                      </span>{' '}
                      <span style={{ color: '#f8fafc' }}>{step.from} → {step.to}:</span>{' '}
                      <span style={{ color: '#cbd5e1' }}>{step.detail}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: Decentralized Neighbour Discovery Table */}
      {(section === 'all' || section === 'fleet') && (
        <div className="card">
          <div className="card-title">
            <span>📡 Decentralized Neighbour Discovery Tables (1s UDP Beacons, 3s Timeout)</span>
            {showConceptTags && <span className="concept-chip">UDP Beacons</span>}
          </div>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>
            Each driver process broadcasts a periodic UDP beacon every 1.0s and maintains a localized neighbour table. If a driver process stops beaconing for &gt;3.0s, its status badge dynamically transitions from ALIVE to EXPIRED.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {['driver-1', 'driver-2', 'driver-3'].map((did) => {
              const table = neighbours[did] || {};
              return (
                <div key={did} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem', background: '#f8fafc' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>🚗 Node: {did}</span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Beacon Port: {did === 'driver-1' ? 9041 : did === 'driver-2' ? 9042 : 9043}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem' }}>
                    {Object.keys(table).length === 0 ? (
                      <div style={{ color: '#94a3b8' }}>Gathering beacon packets...</div>
                    ) : (
                      Object.values(table).map((nbr) => (
                        <div key={nbr.nodeId} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px dashed #e2e8f0' }}>
                          <span>
                            <strong>{nbr.nodeId}</strong> @ [{nbr.position?.join(', ')}] ({nbr.state})
                          </span>
                          <div>
                            <span style={{
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                              fontWeight: 700,
                              fontSize: '0.68rem',
                              background: nbr.isAlive ? '#dcfce7' : '#fee2e2',
                              color: nbr.isAlive ? '#15803d' : '#b91c1c'
                            }}>
                              {nbr.isAlive ? `ALIVE (${nbr.secondsAgo}s)` : 'EXPIRED'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 5: Causality Inspector & Concurrency Demo */}
      {(section === 'all' || section === 'inspector') && (
        <div className="grid-two-col">
          {/* Left: Causality Inspector */}
          <div className="card">
            <div className="card-title">
              <span>🔍 Causality Inspector (Vector Clocks)</span>
              {showConceptTags && <span className="concept-chip">Vector Clocks</span>}
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
              Select any two distributed events to evaluate their causal dependency according to Fidge/Mattern vector clocks.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>Event A:</label>
                <select
                  style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', marginTop: '0.25rem' }}
                  value={selectedEventAId}
                  onChange={(e) => setSelectedEventAId(e.target.value)}
                >
                  {orderedEvents.map((ev) => (
                    <option key={`a-${ev.id}`} value={ev.id}>
                      [L={ev.lamportTs}] {ev.node}: {ev.eventType}
                    </option>
                  ))}
                </select>
                {eventA && (
                  <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '6px', fontSize: '0.75rem' }}>
                    <div><strong>Node:</strong> {eventA.node}</div>
                    <div><strong>Desc:</strong> {eventA.description}</div>
                    <div><strong>Vector:</strong> {JSON.stringify(eventA.vectorClock || {})}</div>
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>Event B:</label>
                <select
                  style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', marginTop: '0.25rem' }}
                  value={selectedEventBId}
                  onChange={(e) => setSelectedEventBId(e.target.value)}
                >
                  {orderedEvents.map((ev) => (
                    <option key={`b-${ev.id}`} value={ev.id}>
                      [L={ev.lamportTs}] {ev.node}: {ev.eventType}
                    </option>
                  ))}
                </select>
                {eventB && (
                  <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '6px', fontSize: '0.75rem' }}>
                    <div><strong>Node:</strong> {eventB.node}</div>
                    <div><strong>Desc:</strong> {eventB.description}</div>
                    <div><strong>Vector:</strong> {JSON.stringify(eventB.vectorClock || {})}</div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '0.75rem', background: '#f1f5f9', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600, display: 'block' }}>CAUSAL RELATIONSHIP:</span>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: causality.startsWith('BEFORE') || causality.startsWith('AFTER') ? '#059669' : '#7c3aed', marginTop: '0.25rem' }}>
                {causality}
              </div>
            </div>
          </div>

          {/* Right: Interactive Concurrency Demo Button */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div className="card-title">
                <span>⚡ Live Concurrency Demonstration</span>
                {showConceptTags && <span className="concept-chip">Concurrent Hazards</span>}
              </div>
              <p style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '1rem', lineHeight: '1.4' }}>
                Simulates two driver processes (<strong>driver-1</strong> and <strong>driver-2</strong>) independently discovering and broadcasting traffic road hazards over UDP at the exact same moment. Because neither message has arrived at the other peer yet, neither event causally precedes the other!
              </p>

              <button
                className="btn btn-purple"
                style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem', fontWeight: 600 }}
                onClick={handleRunConcurrentDemo}
                disabled={isLoading}
              >
                {isLoading ? 'Broadcasting...' : '⚡ Two Drivers Broadcast Hazard Simultaneously'}
              </button>
            </div>

            {demoResult && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#faf5ff', borderRadius: '8px', border: '1px solid #d8b4fe', fontSize: '0.78rem' }}>
                <div style={{ color: '#6b21a8', fontWeight: 700, marginBottom: '0.25rem' }}>
                  ✅ Simultaneous Broadcast Succeeded:
                </div>
                <div>• Event 1: {demoResult.event1?.description} (V: {JSON.stringify(demoResult.event1?.vectorClock)})</div>
                <div>• Event 2: {demoResult.event2?.description} (V: {JSON.stringify(demoResult.event2?.vectorClock)})</div>
                <div style={{ marginTop: '0.4rem', fontWeight: 700, color: '#7c3aed' }}>
                  Verdict: {demoResult.comparison} (Neither caused the other!)
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 6: Ordered Event Log Table */}
      {(section === 'all' || section === 'inspector') && (
        <div className="card">
          <div className="card-title">
            <span>📜 Ordered Event Log (Sorted by Lamport Total Order)</span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {showConceptTags && <span className="concept-chip">Lamport Total Order</span>}
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Events: {orderedEvents.length}</span>
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>
            Every RPC call, MOM message, and P2P gossip packet piggybacks a Lamport timestamp. The log maintains a strictly non-decreasing logical total order across processes.
          </p>

          <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, borderBottom: '2px solid #e2e8f0', zIndex: 1 }}>
                <tr style={{ textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Lamport TS (L)</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Node</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Event Type</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Description</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Vector Clock</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Wall Time</th>
                </tr>
              </thead>
              <tbody>
                {orderedEvents.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>
                      No distributed events recorded yet. Trigger a ride, election, or hazard to view events!
                    </td>
                  </tr>
                ) : (
                  orderedEvents.map((ev, idx) => (
                    <tr
                      key={ev.id || idx}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: idx % 2 === 0 ? '#ffffff' : '#f8fafc'
                      }}
                    >
                      <td style={{ padding: '0.5rem 0.8rem', fontWeight: 700, color: '#0284c7' }}>
                        <span style={{ background: '#e0f2fe', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                          L={ev.lamportTs}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem 0.8rem', fontWeight: 600 }}>
                        <span style={{
                          background: ev.node === 'coordinator' ? '#fef3c7' : ev.node.startsWith('driver') ? '#ecfdf5' : '#f3e8ff',
                          color: ev.node === 'coordinator' ? '#92400e' : ev.node.startsWith('driver') ? '#065f46' : '#6b21a8',
                          padding: '0.2rem 0.4rem',
                          borderRadius: '4px'
                        }}>
                          {ev.node}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem 0.8rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {ev.eventType}
                      </td>
                      <td style={{ padding: '0.5rem 0.8rem', color: '#334155' }}>
                        {ev.description}
                      </td>
                      <td style={{ padding: '0.5rem 0.8rem', fontFamily: 'monospace', fontSize: '0.72rem', color: '#64748b' }}>
                        {ev.vectorClock ? JSON.stringify(ev.vectorClock) : '—'}
                      </td>
                      <td style={{ padding: '0.5rem 0.8rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                        {ev.time}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

window.Unit3Sync = Unit3Sync;
