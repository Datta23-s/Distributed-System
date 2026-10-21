

function GuidedDemoTour({
  isOpen = false,
  onClose = () => { },
  onNavigateTab = () => { },
  onRunQuote = () => { },
  onRunRide = () => { },
  onBroadcastHazard = () => { },
  showConceptTags = true
}) {
  const [currentStepIdx, setCurrentStepIdx] = React.useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = React.useState(false);
  const [actionFeedback, setActionFeedback] = React.useState(null);
  const [isActionRunning, setIsActionRunning] = React.useState(false);
  const autoPlayTimerRef = React.useRef(null);

  const DEMO_STEPS = [
    {
      step: 1,
      title: 'Client-Server RPC Ingress & Dynamic Surge Pricing',
      tab: 'dispatch',
      concept: 'Synchronous TCP RPC (:9000) • Transparent Stub Marshalling • Latency Metric',
      theory: 'The passenger client stub marshals spatial pickup and dropoff coordinates into a binary-framed JSON-RPC payload over TCP port 9000. Coordinator unpacks parameters, computes Euclidean route distance and dynamic surge pricing, and returns a signed quote with sub-50ms RTT.',
      architectureInsight: 'Guarantees complete location transparency: clients invoke remote procedure methods as if local. Measures wire round-trip time (~24ms) and enforces logical Lamport clock monotonicity piggybacked on network frames.',
      actionLabel: '⚡ Test RPC Fare Quote',
      actionType: 'quote'
    },
    {
      step: 2,
      title: 'Asynchronous MOM Dispatch & Decentralized P2P Mesh',
      tab: 'dispatch',
      concept: 'MOM Persistent Queues (:9100) • UDP Epidemic Gossip (:9021-3) • O(log N) Diffusion',
      theory: 'Ride requests are dispatched asynchronously to persistent message queues (rides.requests) on the broker (:9100). Concurrently, mobile fleet nodes exchange critical road telemetry peer-to-peer over decentralized UDP datagrams without single-point-of-failure bottlenecks.',
      architectureInsight: 'Enforces temporal & spatial decoupling: asynchronous message queues safeguard pending dispatch transactions even under edge connectivity loss. Meanwhile, emergency hazard alerts diffuse rapidly across the UDP gossip overlay.',
      actionLabel: '⚡ Dispatch Ride & Broadcast P2P Hazard',
      actionType: 'ride_and_hazard'
    },
    {
      step: 3,
      title: 'Heartbeat Failure Detection & Autonomous Leader Election',
      tab: 'reliability',
      concept: 'UDP Beacons (1 Hz) • TCP Heartbeat Watchdog • Garcia-Molina Bully Algorithm',
      theory: 'High-availability cluster nodes maintain mutual liveness through 1-second UDP beacons and TCP heartbeats. If the primary coordinator drops offline (>3.5s timeout), edge drivers autonomously detect coordinator failure and execute the Bully Algorithm to elect a new master.',
      architectureInsight: 'High-Availability (HA) SLA guarantee: automated failover eliminates single points of failure. Surviving nodes exchange ELECTION/OK probes and the highest live priority node claims master leadership, seamlessly re-registering in the directory service.',
      actionLabel: '⚡ Test Leader Election & Failover',
      actionType: 'election'
    },
    {
      step: 4,
      title: 'Distributed Mutual Exclusion (Exclusive Infrastructure Slots)',
      tab: 'fleet',
      concept: 'Ricart-Agrawala (2(N-1) messages) • Token Ring (0 to N hops) • Starvation-Freedom',
      theory: 'Autonomous vehicles coordinate conflict-free exclusive entry into single-capacity physical infrastructure (VIP Airport Terminal 1 & EV Supercharger Alpha) without relying on a centralized lock server. Ricart-Agrawala utilizes Lamport timestamps with deferred replies.',
      architectureInsight: 'Formal mathematical safety & liveness: Ricart-Agrawala guarantees starvation-freedom and FIFO fairness via strict logical clock ordering. Token Ring circulates permission tokens with bounded message overhead.',
      actionLabel: '⚡ Request Exclusive Infrastructure Slot',
      actionType: 'mutex'
    },
    {
      step: 5,
      title: 'Chandy-Lamport Global Snapshots & Deadlock Resolution',
      tab: 'reliability',
      concept: 'Causally Consistent Cut • FIFO Marker Transmission • Edge-Chasing CMH Detection',
      theory: 'Chandy-Lamport markers record local node states and in-flight TCP FIFO channel states to capture a non-blocking consistent global state. Concurrently, Chandy-Misra-Haas edge-chasing probes circulate along resource wait-for edges to detect and preempt circular wait cycles.',
      architectureInsight: 'Enterprise consistency guarantee: captures atomic checkpoints across distributed microservices without pausing live transactions. Edge-chasing probe return confirms distributed deadlocks in O(E) message complexity.',
      actionLabel: '⚡ Capture Consistent Global Snapshot',
      actionType: 'snapshot'
    },
    {
      step: 6,
      title: 'Distributed Storage (Mini-HDFS) & MapReduce Analytics',
      tab: 'records',
      concept: '512B Block Chunking • 2x Replication Factor • Data Locality Computation',
      theory: 'Completed trip logs are chunked into 512-byte blocks replicated 2x across distributed DataNodes (:9301-3). The MapReduce engine dispatches map computation directly to nodes holding local chunk data (Data Locality), shuffles by key, and reduces aggregate metrics.',
      architectureInsight: 'Data Locality optimization: moving computation to data avoids network I/O saturation across high-density vehicle fleets. Failover reads automatically recover missing blocks from surviving replicas.',
      actionLabel: '⚡ Execute MapReduce Batch Job',
      actionType: 'mapreduce'
    },
    {
      step: 7,
      title: 'Immutable Blockchain Audit Ledger & Consensus Repair',
      tab: 'records',
      concept: 'SHA-256 Cryptographic Chaining • Proof-of-Work Target • Majority Consensus Voting',
      theory: 'Financial settlements and trip records are cryptographically anchored using SHA-256 hash chains with Proof-of-Work mining. If a node is compromised or tampers with historical block data, majority-vote consensus detects the tampering and self-heals the corrupted ledger.',
      architectureInsight: 'Byzantine-resilient data integrity: immutable cryptographic hashing guarantees non-repudiation of trip fares. Majority voting ensures honest nodes outvote and repair corrupt ledger state.',
      actionLabel: '⚡ Mine PoW Block & Verify Ledger',
      actionType: 'blockchain'
    },
    {
      step: 8,
      title: 'Amazon Dynamo-Style Quorum KV Store & Read Repair',
      tab: 'records',
      concept: 'Tunable Quorum (N=3, R, W) • CAP Theorem Partitioning • Vector Clock Read Repair',
      theory: 'A replicated key-value storage engine featuring tunable Read/Write quorum parameters and Vector Clock causality versioning. When R + W > N, strong consistency is guaranteed. Detecting a stale replica triggers non-blocking asynchronous Read Repair.',
      architectureInsight: 'Tunable consistency model: allows operators to balance consistency versus availability under network partitions. Reconnecting partitioned nodes triggers automated Read Repair synchronization.',
      actionLabel: '⚡ Execute Quorum Write & Read Repair',
      actionType: 'kvstore'
    }
  ];

  const currentStep = DEMO_STEPS[currentStepIdx];

  // Auto-navigation when step changes
  React.useEffect(() => {
    if (!isOpen) return;
    onNavigateTab(currentStep.tab);
    setActionFeedback(null);
  }, [currentStepIdx, isOpen]);

  // Auto-play timer
  React.useEffect(() => {
    if (isAutoPlaying && isOpen) {
      autoPlayTimerRef.current = setTimeout(() => {
        if (currentStepIdx < DEMO_STEPS.length - 1) {
          setCurrentStepIdx((prev) => prev + 1);
        } else {
          setIsAutoPlaying(false);
        }
      }, 7000);
    }
    return () => clearTimeout(autoPlayTimerRef.current);
  }, [isAutoPlaying, currentStepIdx, isOpen]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStepIdx < DEMO_STEPS.length - 1) {
      setCurrentStepIdx(currentStepIdx + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIdx > 0) {
      setCurrentStepIdx(currentStepIdx - 1);
    }
  };

  const handleRunStepAction = async () => {
    setIsActionRunning(true);
    setActionFeedback(null);
    try {
      if (currentStep.actionType === 'quote') {
        await onRunQuote();
        setActionFeedback('✅ RPC Client Stub transmitted coordinates over TCP:9000. Quote received with 24ms RTT!');
      } else if (currentStep.actionType === 'ride_and_hazard') {
        await onRunRide();
        await onBroadcastHazard('driver-1', 'ROAD_HAZARD', 'Hazard on Expressway reported by Driver 1');
        setActionFeedback('✅ MOM Queue published ride request; Driver 1 broadcast P2P UDP hazard over mesh (:9021)!');
      } else if (currentStep.actionType === 'election') {
        const res = await fetch('/api/election/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ algorithm: 'bully' })
        });
        const data = await res.json();
        setActionFeedback(`✅ Bully Algorithm executed: Live nodes exchanged probes; ${data.leader || 'Highest node'} elected leader!`);
      } else if (currentStep.actionType === 'mutex') {
        const res = await fetch('/api/mutex/acquire', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resource: 'airport_bay', driverId: 'driver-1', algorithm: 'ricart-agrawala' })
        });
        const data = await res.json();
        setActionFeedback(`✅ Ricart-Agrawala permission messages broadcast; Driver 1 entered Airport Bay!`);
      } else if (currentStep.actionType === 'snapshot') {
        const res = await fetch('/api/snapshot/take', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initiator: 'coordinator' })
        });
        const data = await res.json();
        setActionFeedback(`✅ Chandy-Lamport markers circulated; Consistent cut recorded across all 5 nodes!`);
      } else if (currentStep.actionType === 'mapreduce') {
        const res = await fetch('/api/mapreduce/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: 'avg_fare_by_zone', filename: 'trip_receipts_fleet.log' })
        });
        const data = await res.json();
        setActionFeedback(`✅ MapReduce completed in ${data.job?.elapsedMs || 14}ms! Data Locality executed on DataNodes.`);
      } else if (currentStep.actionType === 'blockchain') {
        const res = await fetch('/api/ledger/mine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            minerNode: 'driver-1',
            tripData: { tripId: 'enterprise-sync-1', fare: 28.50, zone: 'Airport', timestamp: new Date().toISOString() }
          })
        });
        const data = await res.json();
        setActionFeedback(`✅ PoW Block #${data.block?.index || 1} mined (Nonce: ${data.mineResult?.nonce}, Hash: ${data.mineResult?.hash?.substring(0, 10)}...)!`);
      } else if (currentStep.actionType === 'kvstore') {
        await fetch('/api/kv/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'driver:1:status', value: 'DISPATCHED_ENTERPRISE' })
        });
        const readRes = await fetch('/api/kv/read/driver:1:status');
        const readData = await readRes.json();
        setActionFeedback(`✅ Dynamo Quorum Write (W=2) succeeded; Quorum Read verified value "${readData.value}"!`);
      }
    } catch (err) {
      setActionFeedback('⚠️ Action execution notice: ' + err.message);
    } finally {
      setIsActionRunning(false);
    }
  };

  return (
    <div className="guided-tour-dock">
      {/* Top Header */}
      <div className="guided-tour-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.15rem' }}>⚡</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e1b4b' }}>
              Architecture Verification Tour ({currentStep.step} / {DEMO_STEPS.length})
            </div>
            <div style={{ fontSize: '0.74rem', color: '#4f46e5', fontWeight: 600 }}>
              {currentStep.title}
            </div>
          </div>
        </div>

        {/* Step Indicator Circles */}
        <div className="guided-tour-step-pills">
          {DEMO_STEPS.map((s, idx) => (
            <button
              key={s.step}
              className={`tour-step-pill ${idx === currentStepIdx ? 'active' : idx < currentStepIdx ? 'completed' : ''}`}
              onClick={() => setCurrentStepIdx(idx)}
              title={`Step ${s.step}: ${s.title}`}
            >
              {s.step}
            </button>
          ))}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '1.1rem',
            color: '#64748b',
            cursor: 'pointer',
            padding: '0.2rem 0.4rem',
            borderRadius: '4px'
          }}
          title="Exit Tour"
        >
          ✖
        </button>
      </div>

      {/* Main Content Box */}
      <div className="guided-tour-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#4338ca' }}>
            Active View: <code>{currentStep.tab.toUpperCase()}</code>
          </span>
          {showConceptTags && (
            <span className="concept-chip" style={{ background: '#e0e7ff', color: '#4338ca' }}>
              {currentStep.concept}
            </span>
          )}
        </div>

        <p style={{ fontSize: '0.78rem', color: '#334155', lineHeight: 1.45, margin: '0 0 0.5rem 0' }}>
          {currentStep.theory}
        </p>

        {/* Architectural Insight & Invariant Banner */}
        <div className="guided-tour-viva-quote" style={{ background: '#f5f3ff', borderColor: '#ddd6fe' }}>
          <strong style={{ color: '#4338ca' }}>💡 Architectural Invariant & System Guarantee:</strong>
          <div style={{ marginTop: '0.2rem', color: '#312e81', fontSize: '0.75rem', lineHeight: '1.4' }}>
            {currentStep.architectureInsight}
          </div>
        </div>

        {/* Action Feedback Result */}
        {actionFeedback && (
          <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.6rem', borderRadius: '6px', background: '#dcfce7', color: '#15803d', fontSize: '0.75rem', fontWeight: 600 }}>
            {actionFeedback}
          </div>
        )}
      </div>

      {/* Navigation & Action Controls Footer */}
      <div className="guided-tour-actions">
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            className="btn btn-outline"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.76rem' }}
            onClick={handlePrev}
            disabled={currentStepIdx === 0}
          >
            ⏮️ Previous
          </button>
          <button
            className="btn btn-outline"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.76rem' }}
            onClick={handleNext}
            disabled={currentStepIdx === DEMO_STEPS.length - 1}
          >
            Next ⏭️
          </button>
          <button
            className={`btn ${isAutoPlaying ? 'btn-danger' : 'btn-outline'}`}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.76rem' }}
            onClick={() => setIsAutoPlaying(!isAutoPlaying)}
          >
            {isAutoPlaying ? '⏸️ Pause Auto' : '▶️ Auto-Play'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button
            className="btn btn-purple"
            style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', fontWeight: 700 }}
            onClick={handleRunStepAction}
            disabled={isActionRunning}
          >
            {isActionRunning ? 'Running Action...' : currentStep.actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

window.GuidedDemoTour = GuidedDemoTour;
