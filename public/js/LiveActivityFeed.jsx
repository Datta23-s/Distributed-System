

function LiveActivityFeed({ logs = [], orderedEvents = [], showConceptTags }) {
  const [activeView, setActiveView] = React.useState('plain'); // 'plain' | 'lamport' | 'raw'
  const [isPaused, setIsPaused] = React.useState(false);
  const [autoScroll, setAutoScroll] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [expandedLogId, setExpandedLogId] = React.useState(null);
  const [frozenLogs, setFrozenLogs] = React.useState([]);
  const [frozenEvents, setFrozenEvents] = React.useState([]);
  const [clearedBefore, setClearedBefore] = React.useState(0);

  const feedScrollRef = React.useRef(null);

  // When paused, freeze snapshot
  React.useEffect(() => {
    if (!isPaused) {
      setFrozenLogs(logs);
      setFrozenEvents(orderedEvents);
    }
  }, [logs, orderedEvents, isPaused]);

  const displayLogs = (isPaused ? frozenLogs : logs).filter(
    (l) => !clearedBefore || (l.time && new Date(`1970/01/01 ${l.time}`).getTime() > clearedBefore)
  );

  const displayEvents = (isPaused ? frozenEvents : orderedEvents).filter(
    (e) => !clearedBefore || (e.time && new Date(`1970/01/01 ${e.time}`).getTime() > clearedBefore)
  );

  // Auto-scroll to bottom
  React.useEffect(() => {
    if (autoScroll && !isPaused && feedScrollRef.current) {
      feedScrollRef.current.scrollTop = feedScrollRef.current.scrollHeight;
    }
  }, [displayLogs, displayEvents, autoScroll, isPaused, activeView]);

  const handleClear = () => {
    setClearedBefore(Date.now());
  };

  // Plain English Event Translator
  const translateToPlainEnglish = (log) => {
    const cat = log.category;
    const msg = log.message || '';
    const d = log.details || {};

    if (cat === 'RPC') {
      if (msg.includes('estimate_fare')) return `Customer requested ride fare quote from Coordinator via RPC.`;
      if (msg.includes('fare quote')) return `Coordinator computed quote: $${d.estimatedFare || '18.50'} (${d.distanceKm || '4.2'} km) in synchronous RPC call.`;
      if (msg.includes('request_ride')) return `Customer invoked ride booking RPC for route [${d.pickup || ''}] ➔ [${d.dropoff || ''}].`;
      if (msg.includes('assigned to Ride')) return `Coordinator selected nearest driver '${d.driverId}' and assigned Ride '${d.rideId}'.`;
      return `Remote Procedure Call executed: ${msg}`;
    }
    if (cat === 'MOM') {
      if (msg.includes('dispatched to')) return `MOM Message Broker routed dispatch order to driver topic 'driver.${d.driverId || ''}.assignments'.`;
      if (msg.includes('en route to pickup')) return `Driver '${d.driverId || ''}' acknowledged assignment via MOM and is en route to pickup.`;
      if (msg.includes('Customer picked up')) return `Driver '${d.driverId || ''}' picked up customer. Trip waypoint updated to dropoff.`;
      if (msg.includes('completed by Driver')) return `Driver '${d.driverId || ''}' completed ride '${d.rideId || ''}'. Destination reached.`;
      return `MOM Pub/Sub event: ${msg}`;
    }
    if (cat === 'STREAM') {
      return `Driver '${d.driverId || ''}' streaming continuous GPS coordinates (${d.x}, ${d.y}) at 2.5 Hz.`;
    }
    if (cat === 'P2P') {
      return `Driver disseminated road hazard alert directly to peers via UDP epidemic gossip without coordinator.`;
    }
    if (cat === 'DFS') {
      return `Distributed Storage: Trip receipt partitioned into blocks and stored across DataNodes with 2x replication.`;
    }
    if (cat === 'LEDGER') {
      return `Cryptographic Ledger: Block mined using Proof-of-Work hash puzzle to secure trip record.`;
    }
    if (cat === 'KV') {
      return `Replicated KV Store: Driver state written with tunable quorum consensus (W=2 replicas).`;
    }
    if (cat === 'FAULT') {
      return `Fault Detector: Heartbeat timeout detected node crash. Triggering failover.`;
    }
    if (cat === 'ELECTION') {
      return `Leader Election: Distributed election executed. Highest priority node declared leader.`;
    }
    if (cat === 'SYNC') {
      return `Clock Synchronization: Cristian's algorithm adjusted physical clock skew by ±4ms.`;
    }
    if (cat === 'LB') {
      return `Load Balancer: Ingress gateway reverse-proxy routed request via round-robin.`;
    }
    if (cat === 'MUTEX') {
      return `Distributed Mutex: Driver acquired exclusive access to shared resource via Ricart-Agrawala.`;
    }
    return msg;
  };

  // Filter logs by search query
  const query = searchQuery.trim().toLowerCase();
  const filteredLogs = displayLogs.filter((log) => {
    if (!query) return true;
    return (
      (log.category && log.category.toLowerCase().includes(query)) ||
      (log.message && log.message.toLowerCase().includes(query)) ||
      (log.time && log.time.toLowerCase().includes(query))
    );
  });

  const filteredEvents = displayEvents.filter((ev) => {
    if (!query) return true;
    return (
      (ev.eventType && ev.eventType.toLowerCase().includes(query)) ||
      (ev.description && ev.description.toLowerCase().includes(query)) ||
      (ev.node && ev.node.toLowerCase().includes(query)) ||
      (ev.lamportTs && String(ev.lamportTs).includes(query))
    );
  });

  return (
    <div className="card feed-card">
      <div className="feed-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>📡 Live Activity Feed</span>
          <span className="feed-count-badge">
            {activeView === 'lamport' ? filteredEvents.length : filteredLogs.length} events
          </span>
        </div>

        {/* View Mode Selector */}
        <div className="feed-mode-tabs">
          <button
            className={`feed-mode-btn ${activeView === 'plain' ? 'active' : ''}`}
            onClick={() => setActiveView('plain')}
            title="Human-readable event translations"
          >
            💬 Plain English
          </button>
          <button
            className={`feed-mode-btn ${activeView === 'lamport' ? 'active' : ''}`}
            onClick={() => setActiveView('lamport')}
            title="Sorted strictly by Lamport logical clock L=..."
          >
            ⏱ Lamport Order
          </button>
          <button
            className={`feed-mode-btn ${activeView === 'raw' ? 'active' : ''}`}
            onClick={() => setActiveView('raw')}
            title="Protocol packet frames & JSON payloads"
          >
            📦 Raw Packets
          </button>
        </div>
      </div>

      {/* Controls Bar: Search, Auto-scroll, Pause, Clear */}
      <div className="feed-controls-bar">
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            className="feed-search-input"
            placeholder="🔍 Filter by node, protocol, event..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="feed-clear-search-btn" onClick={() => setSearchQuery('')}>×</button>
          )}
        </div>

        <label className="feed-control-label">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          <span>Auto-scroll</span>
        </label>

        <button
          className={`feed-btn ${isPaused ? 'paused' : ''}`}
          onClick={() => setIsPaused((v) => !v)}
          title={isPaused ? 'Resume live streaming' : 'Pause live streaming'}
        >
          {isPaused ? '▶ Resume' : '⏸ Pause'}
        </button>

        <button className="feed-btn" onClick={handleClear} title="Clear logs view">
          🗑 Clear
        </button>
      </div>

      {/* Log Feed Body */}
      <div className="feed-scroll-container" ref={feedScrollRef}>
        {/* VIEW 1: Plain English */}
        {activeView === 'plain' && (
          <div className="feed-list">
            {filteredLogs.length === 0 ? (
              <div className="feed-empty-state">No matching events recorded yet.</div>
            ) : (
              filteredLogs.slice(-40).map((log) => {
                const plainText = translateToPlainEnglish(log);
                return (
                  <div key={log.id} className="feed-row-plain">
                    <span className="feed-timestamp">[{log.time}]</span>
                    <span className={`log-tag ${log.category}`}>{log.category}</span>
                    <span className="feed-plain-text">{plainText}</span>
                    {showConceptTags && (
                      <span className="concept-chip" style={{ fontSize: '0.62rem', marginLeft: 'auto' }}>
                        {log.category}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* VIEW 2: Lamport Order */}
        {activeView === 'lamport' && (
          <div className="feed-list">
            {filteredEvents.length === 0 ? (
              <div className="feed-empty-state">No logical clock events recorded yet.</div>
            ) : (
              filteredEvents.slice(-40).map((ev) => (
                <div key={ev.id} className="feed-row-lamport">
                  <span className="lamport-ts-pill">L = {ev.lamportTs}</span>
                  <span className="feed-timestamp">[{ev.time}]</span>
                  <span className="feed-node-pill">{ev.node}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.78rem', color: '#0f172a' }}>
                      {ev.eventType}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#475569' }}>
                      {ev.description}
                    </div>
                  </div>
                  {ev.vectorClock && (
                    <code className="feed-vc-preview" title="Vector Clock timestamp">
                      {JSON.stringify(ev.vectorClock).replace(/"/g, '')}
                    </code>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* VIEW 3: Raw Packets */}
        {activeView === 'raw' && (
          <div className="feed-list">
            {filteredLogs.length === 0 ? (
              <div className="feed-empty-state">No raw packets recorded yet.</div>
            ) : (
              filteredLogs.slice(-40).map((log) => {
                const isExpanded = expandedLogId === log.id;
                const hasDetails = log.details && Object.keys(log.details).length > 0;
                return (
                  <div key={log.id} className="feed-row-raw">
                    <div
                      className="feed-raw-header"
                      onClick={() => hasDetails && setExpandedLogId(isExpanded ? null : log.id)}
                      style={{ cursor: hasDetails ? 'pointer' : 'default' }}
                    >
                      <span className="feed-timestamp">[{log.time}]</span>
                      <span className={`log-tag ${log.category}`}>{log.category}</span>
                      <span className="feed-raw-msg">{log.message}</span>
                      {hasDetails && (
                        <span className="feed-raw-toggle">{isExpanded ? '▲ JSON' : '▼ JSON'}</span>
                      )}
                    </div>
                    {isExpanded && hasDetails && (
                      <pre className="feed-raw-json">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

window.LiveActivityFeed = LiveActivityFeed;
