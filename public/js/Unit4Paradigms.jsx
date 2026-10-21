

function Unit4Paradigms({ showConceptTags = true, section = 'all' }) {
  const [activeSubTab, setActiveSubTab] = React.useState('datalake'); // datalake, serverless, ledger_kv, lb, caseStudies, all

  // --- Phase 6: DFS State ---
  const [dfsStatus, setDfsStatus] = React.useState(null);
  const [selectedFile, setSelectedFile] = React.useState('trip_receipts_fleet.log');
  const [fileReadResult, setFileReadResult] = React.useState(null);
  const [isDfsLoading, setIsDfsLoading] = React.useState(false);
  const [customFileName, setCustomFileName] = React.useState('');
  const [customFileContent, setCustomFileContent] = React.useState('');
  const [showCustomWrite, setShowCustomWrite] = React.useState(false);

  // --- Phase 6: MapReduce State ---
  const [mrJobId, setMrJobId] = React.useState('avg_fare_by_zone');
  const [mrJobResult, setMrJobResult] = React.useState(null);
  const [isMrRunning, setIsMrRunning] = React.useState(false);

  // --- Phase 7: Serverless State ---
  const [serverlessMetrics, setServerlessMetrics] = React.useState(null);
  const [selectedFunc, setSelectedFunc] = React.useState('estimateFare');
  const [serverlessResult, setServerlessResult] = React.useState(null);
  const [isFaaSLoading, setIsFaaSLoading] = React.useState(false);

  // --- Phase 7: Distributed Objects State ---
  const [objectList, setObjectList] = React.useState([]);
  const [selectedObj, setSelectedObj] = React.useState('obj://driver-1');
  const [selectedMethod, setSelectedMethod] = React.useState('getLocation');
  const [objectResult, setObjectResult] = React.useState(null);
  const [callHistory, setCallHistory] = React.useState([]);

  // --- Phase 8: Load Balancer State ---
  const [lbStats, setLbStats] = React.useState(null);
  const [lbStrategy, setLbStrategy] = React.useState('round-robin');
  const [lbSimResult, setLbSimResult] = React.useState(null);

  // --- Phase 8: Blockchain Ledger State ---
  const [ledgerStatus, setLedgerStatus] = React.useState(null);
  const [isMining, setIsMining] = React.useState(false);
  const [ledgerActionMsg, setLedgerActionMsg] = React.useState(null);

  // --- Phase 8: Quorum KV Store State ---
  const [kvStatus, setKvStatus] = React.useState(null);
  const [quorumR, setQuorumR] = React.useState(2);
  const [quorumW, setQuorumW] = React.useState(2);
  const [kvKey, setKvKey] = React.useState('driver:1:status');
  const [kvVal, setKvVal] = React.useState('AVAILABLE');
  const [kvOpResult, setKvOpResult] = React.useState(null);

  // Fetch initial statuses
  const fetchDfs = () => {
    fetch('/api/dfs/status').then(r => r.json()).then(data => setDfsStatus(data)).catch(() => { });
  };
  const fetchServerless = () => {
    fetch('/api/serverless/metrics').then(r => r.json()).then(data => setServerlessMetrics(data)).catch(() => { });
  };
  const fetchObjects = () => {
    fetch('/api/objects/list').then(r => r.json()).then(data => {
      if (data.status === 'OK') {
        setObjectList(data.objects || []);
        setCallHistory(data.callHistory || []);
      }
    }).catch(() => { });
  };
  const fetchLb = () => {
    fetch('/api/lb/status').then(r => r.json()).then(data => setLbStats(data)).catch(() => { });
  };
  const fetchLedger = () => {
    fetch('/api/ledger/status').then(r => r.json()).then(data => setLedgerStatus(data)).catch(() => { });
  };
  const fetchKv = () => {
    fetch('/api/kv/status').then(r => r.json()).then(data => {
      setKvStatus(data);
      if (data.R) setQuorumR(data.R);
      if (data.W) setQuorumW(data.W);
    }).catch(() => { });
  };

  React.useEffect(() => {
    fetchDfs();
    fetchServerless();
    fetchObjects();
    fetchLb();
    fetchLedger();
    fetchKv();
  }, []);

  // Handlers for Phase 6 (Mini-HDFS)
  const handleWriteSampleLog = async () => {
    setIsDfsLoading(true);
    try {
      const sample = [
        JSON.stringify({ tripId: 'trip-101', driverId: 'driver-1', zone: 'Downtown', fare: 24.50, distanceKm: 8.2 }),
        JSON.stringify({ tripId: 'trip-102', driverId: 'driver-2', zone: 'Airport', fare: 45.00, distanceKm: 22.0 }),
        JSON.stringify({ tripId: 'trip-103', driverId: 'driver-1', zone: 'Downtown', fare: 18.00, distanceKm: 5.5 }),
        JSON.stringify({ tripId: 'trip-104', driverId: 'driver-3', zone: 'Suburbs', fare: 32.50, distanceKm: 14.1 }),
        JSON.stringify({ tripId: 'trip-105', driverId: 'driver-2', zone: 'Airport', fare: 52.00, distanceKm: 25.4 }),
        JSON.stringify({ tripId: 'trip-106', driverId: 'driver-3', zone: 'Downtown', fare: 21.00, distanceKm: 7.0 })
      ].join('\n');

      const res = await fetch('/api/dfs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'trip_receipts_fleet.log', content: sample })
      });
      const data = await res.json();
      if (data.status === 'OK') {
        setSelectedFile('trip_receipts_fleet.log');
        fetchDfs();
      }
    } catch (e) {
      alert('DFS Write failed: ' + e.message);
    } finally {
      setIsDfsLoading(false);
    }
  };

  const handleWriteCustomFile = async () => {
    if (!customFileName.trim() || !customFileContent.trim()) {
      alert('Please provide both filename and content.');
      return;
    }
    setIsDfsLoading(true);
    try {
      const res = await fetch('/api/dfs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: customFileName.trim(), content: customFileContent.trim() })
      });
      const data = await res.json();
      if (data.status === 'OK') {
        setSelectedFile(customFileName.trim());
        setCustomFileName('');
        setCustomFileContent('');
        setShowCustomWrite(false);
        fetchDfs();
      }
    } catch (e) {
      alert('Custom DFS Write failed: ' + e.message);
    } finally {
      setIsDfsLoading(false);
    }
  };

  const handleReadDfsFile = async () => {
    setIsDfsLoading(true);
    try {
      const res = await fetch(`/api/dfs/read/${selectedFile}`);
      const data = await res.json();
      if (data.status === 'OK') {
        setFileReadResult(data.result);
      } else {
        alert('DFS Read failed: ' + data.message);
      }
    } catch (e) {
      alert('DFS Read failed: ' + e.message);
    } finally {
      setIsDfsLoading(false);
    }
  };

  const handleToggleDataNode = async (nodeId, isAlive) => {
    try {
      await fetch('/api/dfs/toggle_datanode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, isAlive })
      });
      fetchDfs();
    } catch (e) {
      alert('Toggle DataNode failed: ' + e.message);
    }
  };

  const handleReReplicate = async () => {
    setIsDfsLoading(true);
    try {
      const res = await fetch('/api/dfs/rereplicate', { method: 'POST' });
      const data = await res.json();
      alert(`Re-replication complete: Restored ${data.restoredChunks} chunks to 2x replication factor!`);
      fetchDfs();
    } catch (e) {
      alert('Re-replication failed: ' + e.message);
    } finally {
      setIsDfsLoading(false);
    }
  };

  // Handlers for Phase 6 (MapReduce)
  const handleRunMapReduce = async () => {
    setIsMrRunning(true);
    try {
      const res = await fetch('/api/mapreduce/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: mrJobId, filename: selectedFile })
      });
      const data = await res.json();
      if (data.status === 'OK') {
        setMrJobResult(data.job);
      }
    } catch (e) {
      alert('MapReduce failed: ' + e.message);
    } finally {
      setIsMrRunning(false);
    }
  };

  // Handlers for Phase 7 (Serverless)
  const handleInvokeServerless = async () => {
    setIsFaaSLoading(true);
    try {
      const params = selectedFunc === 'estimateFare'
        ? { pickup: [25, 30], dropoff: [65, 80], trafficFactor: 1.2 }
        : selectedFunc === 'surgePricing'
          ? { demand: 18, activeDrivers: 2, zone: 'Downtown' }
          : { rideId: 'ride-999', driverId: 'driver-1', fare: 38.50 };

      const res = await fetch('/api/serverless/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funcName: selectedFunc, params })
      });
      const data = await res.json();
      if (data.status === 'OK') {
        setServerlessResult(data.result);
        fetchServerless();
      }
    } catch (e) {
      alert('Serverless invoke failed: ' + e.message);
    } finally {
      setIsFaaSLoading(false);
    }
  };

  // Handlers for Phase 7 (Distributed Objects)
  const handleInvokeObject = async () => {
    try {
      const args = selectedMethod === 'acceptRide' ? ['ride-888'] : [];
      const res = await fetch('/api/objects/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectId: selectedObj, method: selectedMethod, args })
      });
      const data = await res.json();
      if (data.status === 'OK') {
        setObjectResult(data.result);
        if (data.callHistory) setCallHistory(data.callHistory);
      }
    } catch (e) {
      alert('Object invocation failed: ' + e.message);
    }
  };

  // Handlers for Phase 8 (Load Balancer)
  const handleSimulateLbRequest = async () => {
    try {
      const res = await fetch('/api/lb/simulate_request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/api/ride/fare_rates', zone: 'Downtown' })
      });
      const data = await res.json();
      if (data.status === 'OK') {
        setLbSimResult(data.logEntry);
        if (data.stats) setLbStats(data.stats);
      }
    } catch (e) {
      alert('LB request failed: ' + e.message);
    }
  };

  const handleToggleLbInstance = async (id, isAlive) => {
    try {
      await fetch('/api/lb/toggle_instance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId: id, isAlive })
      });
      fetchLb();
    } catch (e) {
      alert('Toggle instance failed: ' + e.message);
    }
  };

  const handleSetLbStrategy = async (strategy) => {
    try {
      await fetch('/api/lb/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy })
      });
      setLbStrategy(strategy);
      fetchLb();
    } catch (e) {
      alert('Set strategy failed: ' + e.message);
    }
  };

  // Handlers for Phase 8 (Blockchain Ledger)
  const handleMineBlock = async () => {
    setIsMining(true);
    try {
      const res = await fetch('/api/ledger/mine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minerNode: 'driver-1',
          tripData: {
            tripId: `trip-${Date.now()}`,
            fare: (Math.random() * 30 + 15).toFixed(2),
            zone: 'Downtown',
            timestamp: new Date().toISOString()
          }
        })
      });
      const data = await res.json();
      if (data.status === 'OK') {
        setLedgerActionMsg(`Block #${data.block.index} mined with PoW Nonce ${data.mineResult.nonce} in ${data.mineResult.elapsedMs}ms!`);
        fetchLedger();
      }
    } catch (e) {
      alert('Mining failed: ' + e.message);
    } finally {
      setIsMining(false);
    }
  };

  const handleTamperBlock = async () => {
    try {
      const res = await fetch('/api/ledger/tamper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId: 'driver-2', blockIndex: 1, fakeFare: 9999.00 })
      });
      const data = await res.json();
      setLedgerActionMsg('Tampered with Block #1 on driver-2! Hash chain broken!');
      fetchLedger();
    } catch (e) {
      alert('Tampering failed: ' + e.message);
    }
  };

  const handleConsensusRepair = async () => {
    try {
      const res = await fetch('/api/ledger/consensus', { method: 'POST' });
      const data = await res.json();
      setLedgerActionMsg(data.result?.summary || 'Consensus verified!');
      fetchLedger();
    } catch (e) {
      alert('Consensus repair failed: ' + e.message);
    }
  };

  // Handlers for Phase 8 (Quorum KV Store)
  const handleUpdateQuorum = async (newR, newW) => {
    try {
      const res = await fetch('/api/kv/quorum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ R: newR, W: newW })
      });
      const data = await res.json();
      if (data.status === 'OK') {
        setQuorumR(newR);
        setQuorumW(newW);
        fetchKv();
      }
    } catch (e) {
      alert('Update quorum failed: ' + e.message);
    }
  };

  const handleKvWrite = async () => {
    try {
      const res = await fetch('/api/kv/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: kvKey, value: kvVal })
      });
      const data = await res.json();
      setKvOpResult(data);
      fetchKv();
    } catch (e) {
      alert('KV write failed: ' + e.message);
    }
  };

  const handleKvRead = async () => {
    try {
      const res = await fetch(`/api/kv/read/${kvKey}`);
      const data = await res.json();
      setKvOpResult(data);
      fetchKv();
    } catch (e) {
      alert('KV read failed: ' + e.message);
    }
  };

  const handleTogglePartition = async (nodeId) => {
    try {
      await fetch('/api/kv/partition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId })
      });
      fetchKv();
    } catch (e) {
      alert('Partition failed: ' + e.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Enterprise Sub-Tabs for Distributed Storage, Compute & Ledger */}
      {(section === 'all' || section === 'records') && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
            <button
              className={`btn ${activeSubTab === 'datalake' || activeSubTab === 'phase6' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveSubTab('datalake')}
              style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem' }}
            >
              📁 Data Lake & MapReduce
            </button>
            <button
              className={`btn ${activeSubTab === 'serverless' || activeSubTab === 'phase7' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveSubTab('serverless')}
              style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem' }}
            >
              ⚡ Serverless FaaS & Objects
            </button>
            <button
              className={`btn ${activeSubTab === 'ledger_kv' || activeSubTab === 'phase8' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveSubTab('ledger_kv')}
              style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem' }}
            >
              ⛓️ Blockchain Ledger & Quorum KV
            </button>
            <button
              className={`btn ${activeSubTab === 'lb' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveSubTab('lb')}
              style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem' }}
            >
              ⚖️ Gateway Cluster & Load Balancer
            </button>
            <button
              className={`btn ${activeSubTab === 'caseStudies' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveSubTab('caseStudies')}
              style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem' }}
            >
              🏢 Industry Architecture Mapping
            </button>
            <button
              className={`btn ${activeSubTab === 'all' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveSubTab('all')}
              style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem' }}
            >
              🌐 Full Overview (All Subsystems)
            </button>
          </div>
        </>
      )}

      {/* =========================================================================
          STORAGE (DFS) & MAPREDUCE (Records & Analytics)
         ========================================================================= */}
      {(activeSubTab === 'datalake' || activeSubTab === 'phase6' || activeSubTab === 'all') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Top Overview Card for Records & Analytics */}
          {section === 'records' && (
            <div className="card" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', borderColor: '#a7f3d0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', color: '#065f46', margin: '0 0 0.35rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>📁 Records & Distributed Big Data Analytics</span>
                    {showConceptTags && <span className="concept-chip" style={{ background: '#d1fae5', color: '#047857' }}>DFS • MapReduce • DLT • Quorum</span>}
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: '#047857', margin: 0, lineHeight: 1.5 }}>
                    Unified distributed persistence pipeline: <strong>Mini-HDFS</strong> (chunked & replicated storage across DataNodes), <strong>MapReduce</strong> (parallel batch analytics with data locality), <strong>Blockchain Ledger</strong> (immutable SHA-256 PoW trip records), and <strong>Dynamo KV Store</strong> (tunable quorum consistency).
                  </p>
                </div>
              </div>

              {/* Live Cluster Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.65rem', marginTop: '1rem' }}>
                <div style={{ background: '#ffffff', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #d1fae5' }}>
                  <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>DFS REPLICATION</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#059669' }}>
                    2x Factor <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b' }}>({dfsStatus?.files?.length || 0} files)</span>
                  </div>
                </div>
                <div style={{ background: '#ffffff', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #d1fae5' }}>
                  <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>MAPREDUCE ENGINE</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#7c3aed' }}>
                    Data Locality <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b' }}>(Mappers on DNs)</span>
                  </div>
                </div>
                <div style={{ background: '#ffffff', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #d1fae5' }}>
                  <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>BLOCKCHAIN CHAIN</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0284c7' }}>
                    {ledgerStatus?.chain?.length || 1} Blocks <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b' }}>(PoW '000')</span>
                  </div>
                </div>
                <div style={{ background: '#ffffff', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #d1fae5' }}>
                  <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>QUORUM CONSISTENCY</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: quorumR + quorumW > 3 ? '#059669' : '#b45309' }}>
                    {quorumR + quorumW > 3 ? 'Strong' : 'Eventual'} <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b' }}>(R={quorumR}, W={quorumW})</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 6.1: Mini-HDFS */}
          <div className="card" style={{ borderLeft: '4px solid #059669' }}>
            <div className="card-title">
              <span style={{ color: '#059669' }}>📁 Distributed File System (Mini-HDFS)</span>
              {showConceptTags && <span className="concept-chip">Mini-HDFS (2x Replication)</span>}
            </div>
            <p style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '1rem' }}>
              Files are split into fixed 512-byte chunks and replicated 2x across distributed DataNodes (Drivers 1, 2, 3) on local disk. Coordinator acts as NameNode managing metadata under <code>./data/namenode/</code>.
            </p>

            {/* DataNode Status Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {dfsStatus?.dataNodes && Object.entries(dfsStatus.dataNodes).map(([nodeId, info]) => (
                <div key={nodeId} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: info.alive ? '#f0fdf4' : '#fef2f2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>DataNode: {nodeId}</span>
                    <span style={{
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: info.alive ? '#dcfce7' : '#fee2e2',
                      color: info.alive ? '#15803d' : '#b91c1c'
                    }}>
                      {info.alive ? 'ONLINE (TCP 930' + nodeId.slice(-1) + ')' : 'CRASHED'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.5rem' }}>
                    Chunks: <strong>{info.chunkCount || 0}</strong> | Port: {info.port}
                  </div>
                  <button
                    className={`btn ${info.alive ? 'btn-danger' : 'btn-outline'}`}
                    style={{ width: '100%', padding: '0.3rem', fontSize: '0.7rem' }}
                    onClick={() => handleToggleDataNode(nodeId, !info.alive)}
                  >
                    {info.alive ? '💥 Crash DataNode' : '✨ Recover DataNode'}
                  </button>
                </div>
              ))}
            </div>

            {/* Actions & File Browser Toolbar */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>Active DFS File:</label>
                <select
                  style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', minWidth: '180px' }}
                  value={selectedFile}
                  onChange={(e) => setSelectedFile(e.target.value)}
                >
                  {dfsStatus?.files && dfsStatus.files.length > 0 ? (
                    dfsStatus.files.map((f) => (
                      <option key={f.filename} value={f.filename}>
                        {f.filename} ({f.sizeBytes} B, {f.chunks?.length} chunks)
                      </option>
                    ))
                  ) : (
                    <option value="trip_receipts_fleet.log">trip_receipts_fleet.log (Default)</option>
                  )}
                </select>
              </div>

              <button
                className="btn btn-outline"
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem' }}
                onClick={handleReadDfsFile}
                disabled={isDfsLoading}
              >
                📖 Read File from DFS
              </button>

              <button
                className="btn btn-primary"
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem' }}
                onClick={handleWriteSampleLog}
                disabled={isDfsLoading}
              >
                📄 Write Sample Fleet Log
              </button>

              <button
                className={`btn ${showCustomWrite ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem' }}
                onClick={() => setShowCustomWrite(!showCustomWrite)}
              >
                {showCustomWrite ? '✖ Close Form' : '➕ Write Custom File'}
              </button>

              <button
                className="btn btn-secondary"
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem', background: '#0284c7', borderColor: '#0284c7', color: '#fff' }}
                onClick={handleReReplicate}
                disabled={isDfsLoading}
              >
                🔄 Re-Replicate Chunks
              </button>
            </div>

            {/* Collapsible Custom File Write Box */}
            {showCustomWrite && (
              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '1.25rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0f172a', marginBottom: '0.5rem' }}>
                  ➕ Write Custom File to Distributed File System (Mini-HDFS)
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Filename (e.g. audit_2026.log)"
                    value={customFileName}
                    onChange={(e) => setCustomFileName(e.target.value)}
                    style={{ flex: 1, minWidth: '200px', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                  />
                  <button
                    className="btn btn-primary"
                    style={{ padding: '0.4rem 0.9rem', fontSize: '0.78rem' }}
                    onClick={handleWriteCustomFile}
                    disabled={isDfsLoading}
                  >
                    {isDfsLoading ? 'Replicating...' : '💾 Save & Replicate (2x)'}
                  </button>
                </div>
                <textarea
                  placeholder="File content to chunk into 512-byte blocks and replicate 2x across DataNodes..."
                  value={customFileContent}
                  onChange={(e) => setCustomFileContent(e.target.value)}
                  rows={3}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.76rem', fontFamily: 'monospace', boxSizing: 'border-box' }}
                />
              </div>
            )}

            {/* Chunk Placement Map */}
            {dfsStatus?.files && dfsStatus.files.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
                  🗺️ NameNode Chunk Placement Map:
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                    <thead>
                      <tr style={{ background: '#e2e8f0', textAlign: 'left', color: '#334155' }}>
                        <th style={{ padding: '0.35rem 0.5rem' }}>File Name</th>
                        <th style={{ padding: '0.35rem 0.5rem' }}>Size</th>
                        <th style={{ padding: '0.35rem 0.5rem' }}>Chunk ID</th>
                        <th style={{ padding: '0.35rem 0.5rem' }}>Replicas (DataNodes)</th>
                        <th style={{ padding: '0.35rem 0.5rem' }}>Health Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dfsStatus.files.flatMap((f) =>
                        f.chunks.map((chk, cIdx) => {
                          const liveReplicaCount = chk.replicas.filter(nid => dfsStatus.dataNodes[nid]?.alive).length;
                          const isHealthy = liveReplicaCount >= 2;
                          const isDegraded = liveReplicaCount === 1;
                          return (
                            <tr key={`${f.filename}-${chk.chunkId}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              {cIdx === 0 && (
                                <td rowSpan={f.chunks.length} style={{ padding: '0.35rem 0.5rem', fontWeight: 700, verticalAlign: 'top', background: '#f8fafc' }}>
                                  {f.filename}
                                </td>
                              )}
                              {cIdx === 0 && (
                                <td rowSpan={f.chunks.length} style={{ padding: '0.35rem 0.5rem', verticalAlign: 'top', background: '#f8fafc' }}>
                                  {f.sizeBytes} B
                                </td>
                              )}
                              <td style={{ padding: '0.35rem 0.5rem', fontFamily: 'monospace', color: '#0284c7' }}>
                                Chunk #{chk.index} ({chk.chunkId})
                              </td>
                              <td style={{ padding: '0.35rem 0.5rem' }}>
                                {chk.replicas.map(nid => (
                                  <span
                                    key={nid}
                                    style={{
                                      display: 'inline-block',
                                      padding: '0.1rem 0.35rem',
                                      borderRadius: '4px',
                                      marginRight: '0.3rem',
                                      fontSize: '0.68rem',
                                      fontWeight: 600,
                                      background: dfsStatus.dataNodes[nid]?.alive ? '#dcfce7' : '#fee2e2',
                                      color: dfsStatus.dataNodes[nid]?.alive ? '#15803d' : '#b91c1c'
                                    }}
                                  >
                                    {nid} {dfsStatus.dataNodes[nid]?.alive ? '✓' : '✗'}
                                  </span>
                                ))}
                              </td>
                              <td style={{ padding: '0.35rem 0.5rem' }}>
                                <span style={{
                                  padding: '0.15rem 0.4rem',
                                  borderRadius: '4px',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  background: isHealthy ? '#dcfce7' : isDegraded ? '#fef3c7' : '#fee2e2',
                                  color: isHealthy ? '#15803d' : isDegraded ? '#b45309' : '#b91c1c'
                                }}>
                                  {isHealthy ? '2x REPLICATED' : isDegraded ? 'UNDER-REPLICATED (1x)' : 'LOST'}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Read Result Viewer */}
            {fileReadResult && (
              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#059669' }}>
                    📖 Read Success: '{fileReadResult.filename}' ({fileReadResult.sizeBytes} bytes)
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Reassembled across {fileReadResult.chunks} chunks
                  </span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#475569', marginBottom: '0.4rem' }}>
                  <strong>Replica Routing Trace:</strong>{' '}
                  {fileReadResult.replicasQueried?.map((r, i) => (
                    <span key={i} style={{ marginRight: '0.5rem', fontFamily: 'monospace' }}>
                      {r.chunkId} &rarr; <strong>{r.node}</strong> ({r.status})
                    </span>
                  ))}
                </div>
                <pre style={{ maxHeight: '120px', overflowY: 'auto', background: '#0f172a', color: '#e2e8f0', padding: '0.5rem', borderRadius: '6px', fontSize: '0.72rem', margin: 0 }}>
                  {fileReadResult.content}
                </pre>
              </div>
            )}
          </div>

          {/* Section 6.2: MapReduce */}
          <div className="card" style={{ borderLeft: '4px solid #7c3aed' }}>
            <div className="card-title">
              <span style={{ color: '#7c3aed' }}>⚡ Distributed MapReduce Engine</span>
              {showConceptTags && <span className="concept-chip">MapReduce Data Locality</span>}
            </div>
            <p style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '1rem' }}>
              Executes parallel batch processing over trip records stored in Mini-HDFS. Demonstrates <strong>Data Locality</strong> (Map runs where chunks are stored on DataNodes), followed by <strong>Shuffle & Partition</strong>, and <strong>Reduce aggregation</strong> on the Coordinator.
            </p>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>Input Dataset:</label>
                <select
                  style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                  value={selectedFile}
                  onChange={(e) => setSelectedFile(e.target.value)}
                >
                  {dfsStatus?.files && dfsStatus.files.length > 0 ? (
                    dfsStatus.files.map((f) => (
                      <option key={f.filename} value={f.filename}>{f.filename}</option>
                    ))
                  ) : (
                    <option value="trip_receipts_fleet.log">trip_receipts_fleet.log</option>
                  )}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>Analytics Job:</label>
                <select
                  style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                  value={mrJobId}
                  onChange={(e) => setMrJobId(e.target.value)}
                >
                  <option value="avg_fare_by_zone">Average Fare & Revenue per Zone</option>
                  <option value="trips_per_driver">Total Completed Trips per Driver</option>
                </select>
              </div>

              <button
                className="btn btn-purple"
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.82rem', fontWeight: 600 }}
                onClick={handleRunMapReduce}
                disabled={isMrRunning}
              >
                {isMrRunning ? 'Computing MapReduce...' : '⚡ Submit MapReduce Job'}
              </button>
            </div>

            {/* Progress Bars & Job Stats */}
            {mrJobResult && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ background: '#f8fafc', padding: '0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                      <span>1. Map Phase (Data Locality)</span>
                      <span style={{ color: '#0284c7' }}>100%</span>
                    </div>
                    <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: '100%', height: '100%', background: '#0284c7' }} />
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.3rem' }}>
                      Mappers executed on DataNodes storing chunks locally.
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                      <span>2. Shuffle & Partition</span>
                      <span style={{ color: '#7c3aed' }}>100%</span>
                    </div>
                    <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: '100%', height: '100%', background: '#7c3aed' }} />
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.3rem' }}>
                      Intermediate pairs grouped and partitioned by key.
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                      <span>3. Reduce Aggregation</span>
                      <span style={{ color: '#059669' }}>100%</span>
                    </div>
                    <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: '100%', height: '100%', background: '#059669' }} />
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.3rem' }}>
                      Coordinator computes aggregated final analytics.
                    </div>
                  </div>
                </div>

                {/* Execution Metrics Bar */}
                <div style={{ display: 'flex', gap: '1rem', background: '#f1f5f9', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.74rem', color: '#475569', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <div>Execution Latency: <strong style={{ color: '#7c3aed' }}>{mrJobResult.elapsedMs || 12}ms</strong></div>
                  <div>Input Records: <strong>{mrJobResult.stats?.totalRecords || mrJobResult.results?.length || 0}</strong></div>
                  <div>Intermediate Pairs: <strong>{mrJobResult.stats?.intermediatePairs || 0}</strong></div>
                  <div>Unique Partitioned Keys: <strong>{mrJobResult.stats?.uniqueKeys || mrJobResult.results?.length || 0}</strong></div>
                </div>

                {/* Results Table */}
                <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1e293b', marginBottom: '0.5rem' }}>
                    📊 Output Analytics ({mrJobResult.title}):
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', textAlign: 'left', color: '#334155' }}>
                        {mrJobResult.results && mrJobResult.results.length > 0 &&
                          Object.keys(mrJobResult.results[0]).map((k) => (
                            <th key={k} style={{ padding: '0.35rem 0.5rem', textTransform: 'capitalize' }}>{k}</th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mrJobResult.results && mrJobResult.results.map((row, rIdx) => (
                        <tr key={rIdx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          {Object.values(row).map((val, vIdx) => (
                            <td key={vIdx} style={{ padding: '0.35rem 0.5rem', fontWeight: vIdx === 0 ? 700 : 400 }}>
                              {typeof val === 'number' && val % 1 !== 0 ? `$${val}` : val}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          SERVERLESS & DISTRIBUTED OBJECTS (System Inspector)
         ========================================================================= */}
      {(section === 'inspector' || activeSubTab === 'serverless' || activeSubTab === 'phase7' || activeSubTab === 'all') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Section 7.1: Serverless FaaS */}
          <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div className="card-title">
              <span style={{ color: '#d97706' }}>⚡ Serverless FaaS Runtime</span>
              {showConceptTags && <span className="concept-chip">FaaS Container Reuse</span>}
            </div>
            <p style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '1rem' }}>
              Standalone FaaS runtime on port 9400. Features simulated <strong>Cold Start (300-800ms)</strong> micro-VM provisioning versus <strong>Warm Container Reuse (5-15ms)</strong> with 12s idle eviction. Events from MOM topics (e.g. <code>rides.status</code> COMPLETED) trigger automated receipt generation.
            </p>

            {/* Metrics Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ background: '#f8fafc', padding: '0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>TOTAL INVOCATIONS</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>{serverlessMetrics?.totalInvocations || 0}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#b45309' }}>COLD STARTS</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#b45309' }}>{serverlessMetrics?.coldStarts || 0}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#059669' }}>WARM STARTS</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#059669' }}>{serverlessMetrics?.warmStarts || 0}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#0284c7' }}>AVG LATENCY</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0284c7' }}>{serverlessMetrics?.avgLatencyMs || 0}ms</div>
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <select
                style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                value={selectedFunc}
                onChange={(e) => setSelectedFunc(e.target.value)}
              >
                <option value="estimateFare">estimateFare (Calculates ride fare & ETA)</option>
                <option value="computeSurge">computeSurge (AI/ML dynamic gradient surge pricing)</option>
                <option value="surgePricing">surgePricing (Demand/supply dynamic pricing)</option>
                <option value="generateReceipt">generateReceipt (Triggered on ride complete)</option>
              </select>

              <button
                className="btn btn-primary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.82rem' }}
                onClick={handleInvokeServerless}
                disabled={isFaaSLoading}
              >
                {isFaaSLoading ? 'Invoking FaaS...' : '🚀 Invoke Serverless Function'}
              </button>
            </div>

            {/* Invocation Result */}
            {serverlessResult && (
              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.8rem', color: serverlessResult.isColdStart ? '#b45309' : '#059669' }}>
                    {serverlessResult.isColdStart ? '❄️ COLD START INVOCATION' : '⚡ WARM CONTAINER REUSE'}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Latency: <strong>{serverlessResult.latencyMs}ms</strong> | Container: {serverlessResult.containerId}
                  </span>
                </div>
                <pre style={{ margin: 0, background: '#0f172a', color: '#e2e8f0', padding: '0.5rem', borderRadius: '6px', fontSize: '0.72rem' }}>
                  {JSON.stringify(serverlessResult.result, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Section 7.2: Distributed Objects */}
          <div className="card" style={{ borderLeft: '4px solid #0284c7' }}>
            <div className="card-title">
              <span style={{ color: '#0284c7' }}>🌐 Distributed Objects & JavaScript Proxy Stubs</span>
              {showConceptTags && <span className="concept-chip">RMI / JS Proxy</span>}
            </div>
            <p style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '1rem' }}>
              Drivers are registered as Remote Object References (ROR) in <code>middleware/objectRegistry.js</code> on port 9500. Client interacts via native ES6 <strong>Proxy Stubs</strong> so remote method calls (<code>driverProxy.getLocation()</code>) look completely local!
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <select
                style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                value={selectedObj}
                onChange={(e) => setSelectedObj(e.target.value)}
              >
                {objectList.map(o => (
                  <option key={o.objectId} value={o.objectId}>{o.objectId} (Host: {o.host}:{o.port})</option>
                ))}
              </select>

              <select
                style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
              >
                <option value="getLocation">getLocation()</option>
                <option value="getStatus">getStatus()</option>
                <option value="acceptRide">acceptRide('ride-888')</option>
              </select>

              <button
                className="btn btn-primary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.82rem' }}
                onClick={handleInvokeObject}
              >
                🌐 Call Remote Method via Proxy Stub
              </button>
            </div>

            {/* Proxy Call Chain Visualization */}
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#334155', marginBottom: '0.4rem' }}>
                🔄 Transparent ES6 Proxy Call Chain:
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.74rem', flexWrap: 'wrap' }}>
                <span style={{ padding: '0.3rem 0.6rem', background: '#dbeafe', color: '#1d4ed8', borderRadius: '4px', fontWeight: 700 }}>
                  1. Local JS Call: proxy.{selectedMethod}()
                </span>
                <span>&rarr;</span>
                <span style={{ padding: '0.3rem 0.6rem', background: '#fef3c7', color: '#b45309', borderRadius: '4px', fontWeight: 700 }}>
                  2. Proxy Trap: Intercepts & Serializes
                </span>
                <span>&rarr;</span>
                <span style={{ padding: '0.3rem 0.6rem', background: '#ecfdf5', color: '#047857', borderRadius: '4px', fontWeight: 700 }}>
                  3. RPC Skeleton: Dispatches on {selectedObj}
                </span>
                <span>&rarr;</span>
                <span style={{ padding: '0.3rem 0.6rem', background: '#f3e8ff', color: '#6b21a8', borderRadius: '4px', fontWeight: 700 }}>
                  4. Return Value Unpacked
                </span>
              </div>
            </div>

            {objectResult && (
              <div style={{ background: '#ffffff', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}>
                <strong style={{ color: '#059669' }}>Proxy Return Value:</strong> {JSON.stringify(objectResult)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          LOAD BALANCER & HTTP CACHING (System Inspector)
         ========================================================================= */}
      {(section === 'inspector' || activeSubTab === 'lb' || activeSubTab === 'all') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Section 8.1: Gateway Load Balancer */}
          <div className="card" style={{ borderLeft: '4px solid #0284c7' }}>
            <div className="card-title">
              <span style={{ color: '#0284c7' }}>⚖️ Gateway Load Balancer & HTTP Caching</span>
              {showConceptTags && <span className="concept-chip">Reverse Proxy & ETag</span>}
            </div>
            <p style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '1rem' }}>
              Reverse proxy on port 5000 fronting 3 Express instances (5001-5003). Features Round-Robin vs Least-Connections balancing, health checks, and HTTP ETag/Cache-Control caching.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              {lbStats?.instances?.map((inst) => (
                <div key={inst.id} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: inst.alive ? '#f0fdf4' : '#fee2e2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{inst.id} (Port {inst.port})</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: inst.alive ? '#15803d' : '#b91c1c' }}>
                      {inst.alive ? 'HEALTHY' : 'CRASHED'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.5rem' }}>
                    Requests Served: <strong>{inst.totalRequests}</strong>
                  </div>
                  <button
                    className={`btn ${inst.alive ? 'btn-danger' : 'btn-outline'}`}
                    style={{ width: '100%', padding: '0.3rem', fontSize: '0.7rem' }}
                    onClick={() => handleToggleLbInstance(inst.id, !inst.alive)}
                  >
                    {inst.alive ? '💥 Kill Gateway Instance' : '✨ Recover Instance'}
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Policy:</label>
                <select
                  style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                  value={lbStrategy}
                  onChange={(e) => handleSetLbStrategy(e.target.value)}
                >
                  <option value="round-robin">Round-Robin</option>
                  <option value="least-connections">Least-Connections</option>
                </select>
              </div>

              <button className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.82rem' }} onClick={handleSimulateLbRequest}>
                🚀 Simulate Client HTTP Request
              </button>

              <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                Cache Hits: <strong>{lbStats?.cacheStats?.hits || 0}</strong> | Misses: <strong>{lbStats?.cacheStats?.misses || 0}</strong>
              </span>
            </div>

            {lbSimResult && (
              <div style={{ background: '#f8fafc', padding: '0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.75rem' }}>
                <strong>Request Served By:</strong> <span style={{ color: '#0284c7', fontWeight: 700 }}>{lbSimResult.servedBy}</span> | Status: {lbSimResult.status} | Latency: {lbSimResult.latencyMs}ms
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          LEDGER & QUORUM KV STORE (Records & Analytics)
         ========================================================================= */}
      {(activeSubTab === 'ledger_kv' || activeSubTab === 'phase8' || activeSubTab === 'all') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Section 8.2: Blockchain Ledger */}
          <div className="card" style={{ borderLeft: '4px solid #7c3aed' }}>
            <div className="card-title">
              <span style={{ color: '#7c3aed' }}>⛏️ Immutable Blockchain & Distributed Ledger (DLT)</span>
              {showConceptTags && <span className="concept-chip">SHA-256 PoW Chain</span>}
            </div>
            <p style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '1rem' }}>
              SHA-256 hash-chained immutable trip ledger replicated across 4 nodes. Features Proof-of-Work (PoW) mining target ('000' prefix) and majority-vote consensus to detect tampering and repair corrupted blocks.
            </p>

            {/* 4-Node Consensus & Integrity Status Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              {['coordinator', 'driver-1', 'driver-2', 'driver-3'].map((nid) => {
                const isNodeValid = ledgerStatus?.nodeStatus?.[nid]?.isValid !== false;
                return (
                  <div
                    key={nid}
                    style={{
                      padding: '0.6rem 0.8rem',
                      borderRadius: '8px',
                      border: `1.5px solid ${isNodeValid ? '#86efac' : '#fca5a5'}`,
                      background: isNodeValid ? '#f0fdf4' : '#fef2f2'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#1e293b' }}>Node: {nid}</span>
                      <span
                        style={{
                          padding: '0.15rem 0.4rem',
                          borderRadius: '4px',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          background: isNodeValid ? '#dcfce7' : '#fee2e2',
                          color: isNodeValid ? '#15803d' : '#b91c1c'
                        }}
                      >
                        {isNodeValid ? '✓ HONEST (PoW Match)' : '🚨 CORRUPTED (Hash Mismatch)'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <button className="btn btn-purple" style={{ padding: '0.5rem 1rem', fontSize: '0.82rem' }} onClick={handleMineBlock} disabled={isMining}>
                {isMining ? 'Mining PoW Block...' : '⛏️ Mine New Trip Block (PoW)'}
              </button>
              <button
                className="btn btn-danger"
                style={{ padding: '0.5rem 1rem', fontSize: '0.82rem' }}
                onClick={handleTamperBlock}
                disabled={!ledgerStatus?.chain || ledgerStatus.chain.length < 2}
                title={!ledgerStatus?.chain || ledgerStatus.chain.length < 2 ? 'Mine at least one trip block (#1) before tampering' : ''}
              >
                🔨 Tamper Block #1 on Driver 2
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', background: '#059669', borderColor: '#059669', color: '#fff' }}
                onClick={handleConsensusRepair}
                disabled={!ledgerStatus?.nodeStatus || !Object.values(ledgerStatus.nodeStatus).some((n) => !n.isValid)}
                title={!ledgerStatus?.nodeStatus || !Object.values(ledgerStatus.nodeStatus).some((n) => !n.isValid) ? 'All node ledgers are currently valid and honest' : ''}
              >
                🛡️ Run Majority Consensus Repair
              </button>
            </div>

            {ledgerActionMsg && (
              <div style={{ padding: '0.5rem', background: '#faf5ff', borderRadius: '6px', border: '1px solid #d8b4fe', fontSize: '0.75rem', marginBottom: '1rem', color: '#6b21a8', fontWeight: 600 }}>
                {ledgerActionMsg}
              </div>
            )}

            {/* Block Explorer */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', textAlign: 'left', color: '#334155' }}>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Block #</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Previous Hash</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Block Hash (PoW Target: '000...')</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Nonce</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Trip Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerStatus?.chain?.map((b) => {
                    const isTampered = b.data?.tampered;
                    return (
                      <tr
                        key={b.index}
                        style={{
                          borderBottom: '1px solid #e2e8f0',
                          background: isTampered ? '#fef2f2' : 'transparent'
                        }}
                      >
                        <td style={{ padding: '0.35rem 0.5rem', fontWeight: 700 }}>
                          #{b.index} {isTampered && <span style={{ color: '#dc2626' }}>🚨 TAMPERED</span>}
                        </td>
                        <td style={{ padding: '0.35rem 0.5rem', fontFamily: 'monospace', color: '#64748b' }}>
                          {b.previousHash ? b.previousHash.substring(0, 10) + '...' : 'GENESIS ROOT'}
                        </td>
                        <td style={{ padding: '0.35rem 0.5rem', fontFamily: 'monospace', fontWeight: 700, color: isTampered ? '#dc2626' : '#059669' }}>
                          <span style={{ background: isTampered ? '#fee2e2' : '#dcfce7', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                            {b.hash.substring(0, 14)}...
                          </span>
                        </td>
                        <td style={{ padding: '0.35rem 0.5rem', fontWeight: 600 }}>{b.nonce}</td>
                        <td style={{ padding: '0.35rem 0.5rem', color: '#334155' }}>
                          {typeof b.data === 'string' ? b.data : JSON.stringify(b.data)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 8.3: Quorum KV Store */}
          <div className="card" style={{ borderLeft: '4px solid #059669' }}>
            <div className="card-title">
              <span style={{ color: '#059669' }}>💾 Replicated KV Store with Tunable Quorum (Dynamo-Style)</span>
              {showConceptTags && <span className="concept-chip">Quorum R + W &gt; N</span>}
            </div>
            <p style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '1rem' }}>
              Amazon Dynamo-style replicated Key-Value store with tunable (N=3, R, W) Quorum, Vector Clock versioning, and Read Repair. Demonstrates CAP theorem (Consistency vs Availability under partitions).
            </p>

            {/* Quorum Configuration Sliders */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700 }}>Cluster Replicas (N): 3</label>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>replica-1, replica-2, replica-3</div>
              </div>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700 }}>Write Quorum (W): {quorumW} / 3</label>
                <input
                  type="range"
                  min="1"
                  max="3"
                  value={quorumW}
                  onChange={(e) => handleUpdateQuorum(quorumR, parseInt(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700 }}>Read Quorum (R): {quorumR} / 3</label>
                <input
                  type="range"
                  min="1"
                  max="3"
                  value={quorumR}
                  onChange={(e) => handleUpdateQuorum(parseInt(e.target.value), quorumW)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* Consistency Level Badge */}
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <span style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 800,
                background: quorumR + quorumW > 3 ? '#dcfce7' : '#fef3c7',
                color: quorumR + quorumW > 3 ? '#15803d' : '#b45309'
              }}>
                {quorumR + quorumW > 3
                  ? `🛡️ STRONG CONSISTENCY (R + W = ${quorumR + quorumW} > 3: Strict Quorum Overlap Guaranteed)`
                  : `⚡ EVENTUAL CONSISTENCY (R + W = ${quorumR + quorumW} <= 3: Risk of Reading Stale Data)`}
              </span>
            </div>

            {/* 3 Replicated Nodes Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              {['replica-1', 'replica-2', 'replica-3'].map((rid) => {
                const rep = kvStatus?.replicas?.[rid] || { isHealthy: true, data: {} };
                const isPartitioned = kvStatus?.partitionedNodes?.includes(rid) || !rep.isHealthy;
                const keys = Object.keys(rep.data || {});
                return (
                  <div
                    key={rid}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: `1.5px solid ${isPartitioned ? '#ef4444' : '#10b981'}`,
                      background: isPartitioned ? '#fff1f2' : '#f0fdf4'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>{rid}</span>
                      <span
                        style={{
                          padding: '0.15rem 0.4rem',
                          borderRadius: '4px',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          background: isPartitioned ? '#fee2e2' : '#dcfce7',
                          color: isPartitioned ? '#b91c1c' : '#15803d'
                        }}
                      >
                        {isPartitioned ? '⚡ PARTITIONED' : '🟢 ONLINE'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.72rem', color: '#475569', marginBottom: '0.5rem' }}>
                      <div>Stored Keys: <strong>{keys.length}</strong></div>
                      <div style={{ marginTop: '0.25rem', maxHeight: '70px', overflowY: 'auto' }}>
                        {keys.length === 0 ? (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No keys stored yet</span>
                        ) : (
                          keys.map((k) => (
                            <div key={k} style={{ fontFamily: 'monospace', fontSize: '0.68rem', background: '#ffffff', padding: '0.2rem 0.35rem', borderRadius: '4px', marginBottom: '0.2rem', border: '1px solid #e2e8f0' }}>
                              <strong>{k}</strong>: "{rep.data[k]?.value}"
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <button
                      className={`btn ${isPartitioned ? 'btn-outline' : 'btn-danger'}`}
                      style={{ width: '100%', padding: '0.3rem', fontSize: '0.7rem' }}
                      onClick={() => handleTogglePartition(rid)}
                    >
                      {isPartitioned ? '✨ Reconnect Replica' : '⚡ Partition Replica'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Actions & Read/Write Form */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Key"
                value={kvKey}
                onChange={(e) => setKvKey(e.target.value)}
                style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', width: '160px' }}
              />
              <input
                type="text"
                placeholder="Value"
                value={kvVal}
                onChange={(e) => setKvVal(e.target.value)}
                style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', width: '160px' }}
              />
              <button className="btn btn-primary" style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }} onClick={handleKvWrite}>
                💾 Quorum Write (W={quorumW})
              </button>
              <button className="btn btn-outline" style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }} onClick={handleKvRead}>
                🔍 Quorum Read (R={quorumR} + Read Repair)
              </button>
            </div>

            {/* Read Repair / Operation Result */}
            {kvOpResult && (
              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.75rem' }}>
                {kvOpResult.readRepairPerformed && (
                  <div style={{ padding: '0.35rem 0.6rem', background: '#dcfce7', color: '#15803d', borderRadius: '4px', fontWeight: 700, marginBottom: '0.4rem' }}>
                    ✅ Read Repair Succeeded: Stale replica ({kvOpResult.staleReplicasRepaired?.join(', ') || 'replica'}) synchronized to latest value "{kvOpResult.value}"!
                  </div>
                )}
                <div><strong>Operation:</strong> {kvOpResult.status} | <strong>Key:</strong> <code>{kvOpResult.key || kvKey}</code> | <strong>Value:</strong> "{kvOpResult.value || kvVal}"</div>
                {kvOpResult.version && (
                  <div style={{ color: '#64748b', marginTop: '0.2rem' }}>
                    Vector Clock Version: <code>{JSON.stringify(kvOpResult.version)}</code>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          INDUSTRY CASE STUDIES MAPPINGS (System Inspector)
         ========================================================================= */}
      {(section === 'inspector' || (section === 'all' && activeSubTab === 'caseStudies')) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ background: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', color: '#0f172a', margin: 0 }}>
                📚 Industry Architecture Mappings (System Reference)
              </h3>
              {showConceptTags && <span className="concept-chip">Architecture Mapping</span>}
            </div>
            <p style={{ fontSize: '0.82rem', color: '#475569', lineHeight: '1.5', margin: 0 }}>
              This section documents how the distributed components implemented in UrbanPulse Dispatch directly correspond to modern production systems:
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ borderLeft: '4px solid #0284c7' }}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0369a1', marginBottom: '0.3rem' }}>
                1. Apache Hadoop (HDFS & MapReduce)
              </div>
              <p style={{ fontSize: '0.78rem', color: '#334155', lineHeight: '1.4' }}>
                <strong>UrbanPulse Module:</strong> <code>services/dfs/</code> & <code>services/mapreduce/</code><br />
                <strong>Concept:</strong> Splits large fleet datasets into chunks replicated 2x across DataNodes. Maps execute locally on DataNodes where chunks reside (Data Locality), reducing network bottleneck.
              </p>
            </div>

            <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#065f46', marginBottom: '0.3rem' }}>
                2. Kubernetes (K8s Self-Healing & Health Probes)
              </div>
              <p style={{ fontSize: '0.78rem', color: '#334155', lineHeight: '1.4' }}>
                <strong>UrbanPulse Module:</strong> <code>middleware/faultMonitor.js</code> & <code>deploy/k8s/</code><br />
                <strong>Concept:</strong> Heartbeat watchdog mirrors K8s Liveness & Readiness Probes. Automatic failover re-dispatches stranded rides when a driver pod crashes.
              </p>
            </div>

            <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#92400e', marginBottom: '0.3rem' }}>
                3. Amazon Web Services (Lambda, S3, DynamoDB)
              </div>
              <p style={{ fontSize: '0.78rem', color: '#334155', lineHeight: '1.4' }}>
                <strong>UrbanPulse Module:</strong> <code>services/serverless/</code> & <code>services/kvstore/</code><br />
                <strong>Concept:</strong> FaaS runtime models AWS Lambda cold/warm container lifecycle; Replicated KV store implements Dynamo's tunable quorum (N, R, W) and asynchronous Read Repair.
              </p>
            </div>

            <div className="card" style={{ borderLeft: '4px solid #7c3aed' }}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#6d28d9', marginBottom: '0.3rem' }}>
                4. Cloudflare (Edge Workers & Reverse Proxy)
              </div>
              <p style={{ fontSize: '0.78rem', color: '#334155', lineHeight: '1.4' }}>
                <strong>UrbanPulse Module:</strong> <code>services/gateway-lb/</code><br />
                <strong>Concept:</strong> Edge reverse proxy with ETag HTTP micro-caching, round-robin load distribution, and automatic failover around unhealthy backend gateways.
              </p>
            </div>

            <div className="card" style={{ borderLeft: '4px solid #dc2626' }}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#991b1b', marginBottom: '0.3rem' }}>
                5. Megaport (Software-Defined Overlay Mesh)
              </div>
              <p style={{ fontSize: '0.78rem', color: '#334155', lineHeight: '1.4' }}>
                <strong>UrbanPulse Module:</strong> <code>middleware/p2pMesh.js</code> & <code>middleware/election.js</code><br />
                <strong>Concept:</strong> On-demand UDP gossip overlay and logical token ring interconnecting edge mobile driver nodes without requiring static physical network wiring.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.Unit4Paradigms = Unit4Paradigms;
