

function PacketFlow({ logs = [] }) {
  const [activePackets, setActivePackets] = React.useState([]);

  // Trigger packet animations when new protocol logs arrive
  React.useEffect(() => {
    if (logs.length > 0) {
      const latest = logs[logs.length - 1];
      const packet = {
        id: latest.id,
        category: latest.category,
        message: latest.message,
        time: Date.now()
      };
      setActivePackets((prev) => [...prev.slice(-6), packet]);
    }
  }, [logs]);

  return (
    <div className="card">
      <div className="card-title">
        <span>🌐 Distributed Topology & Protocol Flow</span>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Live Network Links</span>
      </div>

      <div style={{ position: 'relative', width: '100%', height: '380px', background: '#f0f9ff', borderRadius: '10px', border: '1px solid #bae6fd', overflow: 'hidden' }}>
        <svg width="100%" height="100%" viewBox="0 0 600 360">
          <defs>
            {/* Markers */}
            <marker id="arrow-rpc" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#0284c7" />
            </marker>
            <marker id="arrow-mom" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#059669" />
            </marker>
            <marker id="arrow-p2p" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#7c3aed" />
            </marker>
          </defs>

          {/* Links */}
          {/* RPC Link: Customer <-> Coordinator */}
          <line x1="100" y1="180" x2="280" y2="100" stroke="#0284c7" strokeWidth="2" strokeDasharray="4,4" />
          <text x="175" y="130" fill="#0284c7" fontSize="10" fontWeight="bold">RPC Call / Return</text>

          {/* MOM Link: Coordinator <-> MOM Broker */}
          <line x1="300" y1="130" x2="300" y2="240" stroke="#059669" strokeWidth="2" />
          <text x="310" y="190" fill="#059669" fontSize="10" fontWeight="bold">MOM Pub/Sub</text>

          {/* Dispatch Links: MOM Broker <-> Drivers */}
          <line x1="330" y1="260" x2="480" y2="90" stroke="#059669" strokeWidth="1.5" strokeDasharray="3,3" />
          <line x1="340" y1="270" x2="480" y2="180" stroke="#059669" strokeWidth="1.5" strokeDasharray="3,3" />
          <line x1="330" y1="280" x2="480" y2="270" stroke="#059669" strokeWidth="1.5" strokeDasharray="3,3" />

          {/* P2P Gossip Links between Drivers (Overlay Mesh) */}
          <line x1="500" y1="110" x2="500" y2="160" stroke="#7c3aed" strokeWidth="2.5" />
          <line x1="500" y1="200" x2="500" y2="250" stroke="#7c3aed" strokeWidth="2.5" />
          <path d="M 520 90 Q 580 180 520 270" fill="none" stroke="#7c3aed" strokeWidth="2" strokeDasharray="3,3" />
          <text x="545" y="185" fill="#7c3aed" fontSize="10" fontWeight="bold">P2P Mesh</text>

          {/* Customer Node */}
          <g transform="translate(100, 180)">
            <circle r="32" fill="#ffffff" stroke="#0284c7" strokeWidth="2.5" />
            <text textAnchor="middle" y="-6" fill="#0f172a" fontSize="11" fontWeight="bold">Customer</text>
            <text textAnchor="middle" y="10" fill="#475569" fontSize="9">Client Stub</text>
            <text textAnchor="middle" y="22" fill="#0284c7" fontSize="8">WebRTC Peer</text>
          </g>

          {/* Coordinator Node */}
          <g transform="translate(300, 90)">
            <rect x="-65" y="-30" width="130" height="60" rx="10" fill="#ffffff" stroke="#d97706" strokeWidth="2.5" />
            <text textAnchor="middle" y="-8" fill="#0f172a" fontSize="11" fontWeight="bold">Coordinator</text>
            <text textAnchor="middle" y="8" fill="#475569" fontSize="9">RPC Skeleton (9000)</text>
            <text textAnchor="middle" y="20" fill="#d97706" fontSize="8">Fault Monitor (Heartbeat)</text>
          </g>

          {/* MOM Broker Node */}
          <g transform="translate(300, 270)">
            <rect x="-65" y="-25" width="130" height="50" rx="8" fill="#ffffff" stroke="#059669" strokeWidth="2.5" />
            <text textAnchor="middle" y="-4" fill="#0f172a" fontSize="11" fontWeight="bold">MOM Broker</text>
            <text textAnchor="middle" y="12" fill="#059669" fontSize="8">Queues & Topics (9100)</text>
          </g>

          {/* Driver 1 Node */}
          <g transform="translate(500, 80)">
            <circle r="26" fill="#ffffff" stroke="#059669" strokeWidth="2.5" />
            <text textAnchor="middle" y="-2" fill="#0f172a" fontSize="10" fontWeight="bold">Driver 1</text>
            <text textAnchor="middle" y="12" fill="#7c3aed" fontSize="8">UDP 9021</text>
          </g>

          {/* Driver 2 Node */}
          <g transform="translate(500, 180)">
            <circle r="26" fill="#ffffff" stroke="#0284c7" strokeWidth="2.5" />
            <text textAnchor="middle" y="-2" fill="#0f172a" fontSize="10" fontWeight="bold">Driver 2</text>
            <text textAnchor="middle" y="12" fill="#7c3aed" fontSize="8">UDP 9022</text>
          </g>

          {/* Driver 3 Node */}
          <g transform="translate(500, 280)">
            <circle r="26" fill="#ffffff" stroke="#059669" strokeWidth="2.5" />
            <text textAnchor="middle" y="-2" fill="#0f172a" fontSize="10" fontWeight="bold">Driver 3</text>
            <text textAnchor="middle" y="12" fill="#7c3aed" fontSize="8">UDP 9023</text>
          </g>
        </svg>

        {/* Legend */}
        <div style={{ position: 'absolute', bottom: '8px', left: '12px', display: 'flex', gap: '12px', background: 'rgba(255,255,255,0.95)', border: '1px solid #bae6fd', padding: '6px 12px', borderRadius: '6px', fontSize: '0.72rem', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
          <span style={{ color: '#0284c7' }}>● RPC (TCP)</span>
          <span style={{ color: '#059669' }}>● MOM Queue/Topic</span>
          <span style={{ color: '#7c3aed' }}>● P2P Gossip (UDP)</span>
          <span style={{ color: '#d97706' }}>● Telemetry Stream</span>
        </div>
      </div>
    </div>
  );
}

window.PacketFlow = PacketFlow;
