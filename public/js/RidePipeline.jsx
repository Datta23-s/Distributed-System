

function RidePipeline({ pipeline, showConceptTags }) {
  const stepsConfig = [
    {
      id: 'quote',
      label: '1. Quote',
      service: 'Pricing FaaS (:9400) / RPC',
      concept: 'RPC, FaaS',
      icon: '💲',
      summary: 'Fare & ETA estimation via synchronous RPC'
    },
    {
      id: 'match',
      label: '2. Match',
      service: 'Driver RMI (:9501) / Registry',
      concept: 'Distributed Object / Registry',
      icon: '🎯',
      summary: 'Nearest driver discovery via Service Registry & RMI'
    },
    {
      id: 'dispatch',
      label: '3. Dispatch',
      service: 'MOM Broker (:9100)',
      concept: 'MOM Pub/Sub',
      icon: '📬',
      summary: 'Assignment published to driver queue via MOM'
    },
    {
      id: 'intrip',
      label: '4. In Trip',
      service: 'UDP Stream (:9041) / WebRTC',
      concept: 'UDP Telemetry / WebRTC',
      icon: '🚗',
      summary: 'Continuous 2.5Hz GPS streaming & P2P WebRTC'
    },
    {
      id: 'complete',
      label: '5. Complete',
      service: 'Driver State Machine',
      concept: 'State Machine',
      icon: '🏁',
      summary: 'Vehicle reached destination, state transitions'
    },
    {
      id: 'analytics',
      label: '6. Analytics',
      service: 'Mini-HDFS + Ledger + KV',
      concept: 'DFS, Blockchain DLT, Quorum KV',
      icon: '📊',
      summary: 'Receipt stored 2x in HDFS, PoW block mined, KV synced'
    }
  ];

  const overallStatus = pipeline.status || 'IDLE'; // IDLE | DISPATCHING | IN_TRIP | COMPLETED

  const getStatusBadgeClass = () => {
    switch (overallStatus) {
      case 'IN_TRIP': return 'pipeline-badge-active';
      case 'DISPATCHING': return 'pipeline-badge-busy';
      case 'COMPLETED': return 'pipeline-badge-done';
      default: return 'pipeline-badge-idle';
    }
  };

  return (
    <div className="card pipeline-card">
      <div className="card-title" style={{ marginBottom: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>⚡ Distributed Ride Pipeline</span>
          <span className={`pipeline-status-badge ${getStatusBadgeClass()}`}>
            {overallStatus}
          </span>
        </div>
        {pipeline.rideId && (
          <code style={{ fontSize: '0.72rem', color: '#0284c7', background: '#f0f9ff', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
            {pipeline.rideId}
          </code>
        )}
      </div>

      <p style={{ fontSize: '0.76rem', color: '#64748b', margin: '0 0 0.85rem 0', lineHeight: 1.35 }}>
        End-to-end distributed execution chain across RPC, MOM queues, UDP streams, DFS storage, and Blockchain ledger.
      </p>

      {/* 6 Step Visual Track */}
      <div className="pipeline-stepper-grid">
        {stepsConfig.map((cfg, index) => {
          const stepData = (pipeline.steps && pipeline.steps[cfg.id]) || { status: 'idle' };
          const stepStatus = stepData.status || 'idle'; // idle | in-progress | done | failed

          return (
            <div key={cfg.id} className={`stepper-node ${stepStatus}`}>
              <div className="stepper-node-header">
                <div className="stepper-icon-circle">
                  {stepStatus === 'done' ? '✓' : (stepStatus === 'failed' ? '✕' : cfg.icon)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="stepper-node-title">{cfg.label}</div>
                  <div className="stepper-node-service">{cfg.service}</div>
                </div>
              </div>

              <div className="stepper-node-desc">
                {stepData.info || cfg.summary}
              </div>

              <div className="stepper-node-footer">
                {stepData.latencyMs !== null && stepData.latencyMs !== undefined ? (
                  <span className="stepper-metric">⚡ {stepData.latencyMs}ms</span>
                ) : (
                  <span className={`stepper-state-pill ${stepStatus}`}>{stepStatus.toUpperCase()}</span>
                )}

                {showConceptTags && (
                  <span className="concept-chip" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                    {cfg.concept}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!pipeline.active && overallStatus === 'IDLE' && (
        <div className="pipeline-idle-notice">
          💡 Click <strong>Get Quote</strong> or <strong>Request Ride</strong> above to execute the 6-stage distributed pipeline in real time.
        </div>
      )}
    </div>
  );
}

window.RidePipeline = RidePipeline;
