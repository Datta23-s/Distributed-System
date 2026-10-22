// UrbanPulse Dispatch — Admin Operations & Fleet Management Dashboard
// Complies with Section 15 of UrbanPulse Master Spec

function AdminDashboard({ authToken }) {
  const [adminToken, setAdminToken] = React.useState(null);
  const [metrics, setMetrics] = React.useState(null);
  const [rides, setRides] = React.useState([]);
  const [drivers, setDrivers] = React.useState([]);
  const [fares, setFares] = React.useState([]);
  const [tickets, setTickets] = React.useState([]);
  const [activeTab, setActiveTab] = React.useState('rides'); // 'rides' | 'drivers' | 'fares' | 'tickets'
  const [editingFare, setEditingFare] = React.useState(null);

  // Authenticate as Admin
  React.useEffect(() => {
    fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@urbanpulse.in', password: 'Password@123' })
    })
      .then(res => res.json())
      .then(data => {
        if (data.token) {
          setAdminToken(data.token);
          loadAdminData(data.token);
        }
      })
      .catch(err => console.error('Admin login error:', err));
  }, []);

  const loadAdminData = (token) => {
    // 1. Metrics
    fetch('/api/v1/admin/overview', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.metrics) setMetrics(d.metrics); });

    // 2. Rides
    fetch('/api/v1/admin/rides', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.rides) setRides(d.rides); });

    // 3. Drivers
    fetch('/api/v1/admin/drivers', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.drivers) setDrivers(d.drivers); });

    // 4. Fares
    fetch('/api/v1/admin/fares', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.fares) setFares(d.fares); });

    // 5. Support Tickets
    fetch('/api/v1/admin/tickets', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.tickets) setTickets(d.tickets); });
  };

  // Update Fare Configuration
  const handleSaveFare = async (fareId) => {
    if (!editingFare) return;
    try {
      const res = await fetch(`/api/v1/admin/fares/${fareId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(editingFare)
      });
      const data = await res.json();
      if (data.success) {
        alert('Pricing rules updated successfully!');
        setEditingFare(null);
        loadAdminData(adminToken);
      }
    } catch (e) {
      alert('Failed to update pricing rules');
    }
  };

  // Resolve Ticket
  const handleToggleTicket = async (ticketId, currentStatus) => {
    const next = currentStatus === 'OPEN' ? 'RESOLVED' : 'OPEN';
    try {
      await fetch(`/api/v1/admin/tickets/${ticketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: next })
      });
      loadAdminData(adminToken);
    } catch (e) { }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '1.5rem auto', padding: '0 1rem' }}>
      {/* Overview Stat Cards */}
      <div className="up-admin-grid">
        <div className="up-stat-card">
          <div className="up-stat-label">Active Rides</div>
          <div className="up-stat-val" style={{ color: 'var(--up-blue)' }}>{metrics?.activeRides || 0}</div>
        </div>
        <div className="up-stat-card">
          <div className="up-stat-label">Completed Trips</div>
          <div className="up-stat-val" style={{ color: '#059669' }}>{metrics?.completedRides || 0}</div>
        </div>
        <div className="up-stat-card">
          <div className="up-stat-label">Cancelled Rides</div>
          <div className="up-stat-val" style={{ color: '#dc2626' }}>{metrics?.cancelledRides || 0}</div>
        </div>
        <div className="up-stat-card">
          <div className="up-stat-label">Available Drivers</div>
          <div className="up-stat-val">{metrics?.availableDrivers || 0} / {metrics?.totalDrivers || 0}</div>
        </div>
        <div className="up-stat-card">
          <div className="up-stat-label">Total Revenue</div>
          <div className="up-stat-val" style={{ color: '#059669' }}>₹{metrics?.totalRevenue.toLocaleString('en-IN') || 0}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', background: '#ffffff', padding: '0.5rem', borderRadius: '12px', border: '1px solid var(--up-border)', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('rides')}
          className={`up-portal-btn ${activeTab === 'rides' ? 'active' : ''}`}
        >
          🚕 Live Rides & History ({rides.length})
        </button>
        <button
          onClick={() => setActiveTab('drivers')}
          className={`up-portal-btn ${activeTab === 'drivers' ? 'active' : ''}`}
        >
          👤 Fleet Drivers ({drivers.length})
        </button>
        <button
          onClick={() => setActiveTab('fares')}
          className={`up-portal-btn ${activeTab === 'fares' ? 'active' : ''}`}
        >
          💰 Fare & Surge Configuration ({fares.length})
        </button>
        <button
          onClick={() => setActiveTab('tickets')}
          className={`up-portal-btn ${activeTab === 'tickets' ? 'active' : ''}`}
        >
          🎫 Safety & Support Tickets ({tickets.length})
        </button>
      </div>

      {/* TAB 1: RIDES TABLE */}
      {activeTab === 'rides' && (
        <div style={{ background: '#ffffff', border: '1px solid var(--up-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--up-border)' }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem' }}>Ride Ref</th>
                <th style={{ padding: '0.75rem 1rem' }}>Category</th>
                <th style={{ padding: '0.75rem 1rem' }}>Customer</th>
                <th style={{ padding: '0.75rem 1rem' }}>Driver</th>
                <th style={{ padding: '0.75rem 1rem' }}>Route</th>
                <th style={{ padding: '0.75rem 1rem' }}>Fare</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rides.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{r.rideNumber}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{r.vehicleCategory}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{r.customer?.name}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{r.driver ? r.driver.user.name : '—'}</td>
                  <td style={{ padding: '0.75rem 1rem', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.pickupAddress} &rarr; {r.destAddress}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#059669' }}>
                    ₹{r.finalFare || r.estimatedFare}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span className={`up-status-badge ${r.status.toLowerCase()}`}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: DRIVERS FLEET */}
      {activeTab === 'drivers' && (
        <div style={{ background: '#ffffff', border: '1px solid var(--up-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--up-border)' }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem' }}>Driver Name</th>
                <th style={{ padding: '0.75rem 1rem' }}>Vehicle Model</th>
                <th style={{ padding: '0.75rem 1rem' }}>License Plate</th>
                <th style={{ padding: '0.75rem 1rem' }}>Trips</th>
                <th style={{ padding: '0.75rem 1rem' }}>Total Earnings</th>
                <th style={{ padding: '0.75rem 1rem' }}>Rating</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map(d => (
                <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{d.user.name}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{d.vehicles[0]?.make} {d.vehicles[0]?.model} ({d.vehicles[0]?.category})</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span className="up-plate-badge">{d.vehicles[0]?.licensePlate}</span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>{d.totalTrips}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>₹{d.totalEarnings.toLocaleString('en-IN')}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>⭐ {d.rating}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{
                      fontWeight: 700, fontSize: '0.78rem', padding: '0.2rem 0.5rem', borderRadius: '999px',
                      background: d.status === 'AVAILABLE' ? '#ecfdf5' : '#f1f5f9',
                      color: d.status === 'AVAILABLE' ? '#059669' : '#475569'
                    }}>
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: FARE & SURGE CONFIGURATION */}
      {activeTab === 'fares' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {fares.map(f => (
            <div key={f.id} style={{ background: '#ffffff', border: '1px solid var(--up-border)', borderRadius: '12px', padding: '1.25rem', boxShadow: 'var(--up-shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--up-navy)' }}>{f.category}</span>
                <span style={{ fontSize: '0.78rem', background: '#eff6ff', color: 'var(--up-blue)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>Active</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.88rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--up-text-muted)' }}>Base Fare (INR):</span>
                  <b>₹{f.baseFare}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--up-text-muted)' }}>Per Km Rate:</span>
                  <b>₹{f.perKmRate} / km</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--up-text-muted)' }}>Per Minute Rate:</span>
                  <b>₹{f.perMinuteRate} / min</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--up-text-muted)' }}>Minimum Fare:</span>
                  <b>₹{f.minimumFare}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--up-text-muted)' }}>Surge Multiplier:</span>
                  <b style={{ color: f.surgeMultiplier > 1 ? '#d97706' : '#059669' }}>{f.surgeMultiplier}x</b>
                </div>
              </div>

              <button
                onClick={() => setEditingFare(f)}
                style={{ width: '100%', marginTop: '1rem', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--up-border)', background: '#f8fafc', fontWeight: 600, cursor: 'pointer' }}
              >
                ✏️ Edit Pricing
              </button>
            </div>
          ))}

          {/* Edit Fare Modal */}
          {editingFare && (
            <div className="up-modal-overlay">
              <div className="up-modal-card">
                <div className="up-modal-header">
                  <h3 style={{ margin: 0, fontWeight: 700 }}>Edit {editingFare.category} Pricing</h3>
                  <button onClick={() => setEditingFare(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                </div>
                <div className="up-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Base Fare (₹)</label>
                    <input
                      type="number"
                      value={editingFare.baseFare}
                      onChange={(e) => setEditingFare({ ...editingFare, baseFare: parseFloat(e.target.value) })}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--up-border)', marginTop: '0.2rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Per Km Rate (₹)</label>
                    <input
                      type="number"
                      value={editingFare.perKmRate}
                      onChange={(e) => setEditingFare({ ...editingFare, perKmRate: parseFloat(e.target.value) })}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--up-border)', marginTop: '0.2rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Surge Multiplier (e.g. 1.25)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={editingFare.surgeMultiplier}
                      onChange={(e) => setEditingFare({ ...editingFare, surgeMultiplier: parseFloat(e.target.value) })}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--up-border)', marginTop: '0.2rem' }}
                    />
                  </div>
                </div>
                <div className="up-modal-footer">
                  <button className="up-btn-primary" onClick={() => handleSaveFare(editingFare.id)}>
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SUPPORT TICKETS */}
      {activeTab === 'tickets' && (
        <div style={{ background: '#ffffff', border: '1px solid var(--up-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--up-border)' }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem' }}>User</th>
                <th style={{ padding: '0.75rem 1rem' }}>Category</th>
                <th style={{ padding: '0.75rem 1rem' }}>Subject</th>
                <th style={{ padding: '0.75rem 1rem' }}>Message</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--up-text-muted)' }}>
                    No support tickets reported.
                  </td>
                </tr>
              ) : (
                tickets.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{t.user.name}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.45rem', borderRadius: '4px', background: '#fee2e2', color: '#991b1b' }}>
                        {t.category}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{t.subject}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--up-text-muted)' }}>{t.message}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ fontWeight: 700, color: t.status === 'RESOLVED' ? '#059669' : '#d97706' }}>{t.status}</span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <button
                        onClick={() => handleToggleTicket(t.id, t.status)}
                        style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid var(--up-border)', background: '#f8fafc', cursor: 'pointer', fontSize: '0.78rem' }}
                      >
                        {t.status === 'RESOLVED' ? 'Reopen' : 'Mark Resolved'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
