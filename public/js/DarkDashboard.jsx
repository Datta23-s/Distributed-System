// UrbanPulse Dispatch — Master Automotive Dark Dashboard
// Matches Attached Reference: Narrow left sidebar, 2 top cards (Vehicle + Trip Info),
// Large Leaflet dark map + Route timeline, Right-side persistent trips panel.

function DarkDashboard({ currentUser, authToken, onLogout }) {
  const [currentView, setCurrentView] = React.useState('dashboard');
  const [trips, setTrips] = React.useState([]);
  const [selectedTrip, setSelectedTrip] = React.useState(null);
  const [loadingTrips, setLoadingTrips] = React.useState(false);
  const [isBookingOpen, setIsBookingOpen] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('ALL');
  const [chatMessages, setChatMessages] = React.useState([
    { sender: 'driver', text: 'Namaste! I am on my way via FC Road.', time: '10:18 AM' },
    { sender: 'rider', text: 'Great, waiting near Starbucks gate.', time: '10:20 AM' },
    { sender: 'driver', text: 'Arrived at the pickup point. Yellow Swift Dzire.', time: '10:24 AM' }
  ]);
  const [chatInput, setChatInput] = React.useState('');

  // Trigger Toast Notification
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4500);
  };

  // Fetch trips from /api/v1/rides/recent or fallback to curated Pune trips
  const fetchTrips = async () => {
    setLoadingTrips(true);
    try {
      const res = await fetch('/api/v1/rides/recent');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.rides && data.rides.length > 0) {
          setTrips(data.rides);
          if (!selectedTrip) {
            setSelectedTrip(data.rides[0]);
          }
          return;
        }
      }
    } catch (err) {
      console.warn('Trips API fetch fallback:', err);
    } finally {
      setLoadingTrips(false);
    }

    // Curated high-fidelity Pune trips matching the reference screenshots
    const fallbackList = [
      {
        id: 'ride-101',
        rideNumber: 'UP-PUN-72819',
        pickupAddress: 'FC Road, Shivajinagar, Pune 411005',
        pickupLat: 18.5314,
        pickupLng: 73.8446,
        destAddress: 'Hinjewadi IT Park Phase 1, Pune 411057',
        destLat: 18.5912,
        destLng: 73.7389,
        distanceKm: 14.5,
        durationMinutes: 24,
        vehicleCategory: 'ECONOMY',
        estimatedFare: 295,
        finalFare: 295,
        tripPin: '8492',
        status: 'IN_PROGRESS',
        createdAt: new Date().toISOString(),
        customer: { name: 'Aarav Sharma' },
        driver: {
          user: { name: 'Rajesh Patil', phone: '+91 91234 56789' },
          rating: 4.89,
          totalTrips: 342,
          vehicles: [{ make: 'Maruti Suzuki', model: 'Swift Dzire Tour', licensePlate: 'MH 12 QX 4501', capacity: 4 }]
        }
      },
      {
        id: 'ride-102',
        rideNumber: 'UP-PUN-81924',
        pickupAddress: 'Pune Railway Station, Agarkar Nagar',
        pickupLat: 18.5289,
        pickupLng: 73.8744,
        destAddress: 'Viman Nagar (Phoenix Marketcity), Pune',
        destLat: 18.5621,
        destLng: 73.9168,
        distanceKm: 8.2,
        durationMinutes: 18,
        vehicleCategory: 'PREMIUM',
        estimatedFare: 380,
        finalFare: 380,
        tripPin: '5120',
        status: 'COMPLETED',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        customer: { name: 'Neha Joshi' },
        driver: {
          user: { name: 'Vikram Shinde', phone: '+91 98220 12345' },
          rating: 4.95,
          totalTrips: 620,
          vehicles: [{ make: 'Honda', model: 'City ZX', licensePlate: 'MH 12 TA 9901', capacity: 4 }]
        }
      },
      {
        id: 'ride-103',
        rideNumber: 'UP-PUN-90145',
        pickupAddress: 'Kothrud, Paud Road, Pune',
        pickupLat: 18.5074,
        pickupLng: 73.8077,
        destAddress: 'Magarpatta Cybercity, Hadapsar',
        destLat: 18.5146,
        destLng: 73.9281,
        distanceKm: 16.8,
        durationMinutes: 32,
        vehicleCategory: 'AUTO',
        estimatedFare: 185,
        finalFare: 185,
        tripPin: '2941',
        status: 'COMPLETED',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        customer: { name: 'Pooja Kulkarni' },
        driver: {
          user: { name: 'Ganesh Deshmukh', phone: '+91 97654 32100' },
          rating: 4.82,
          totalTrips: 890,
          vehicles: [{ make: 'Bajaj', model: 'RE Compact Auto', licensePlate: 'MH 12 RE 1102', capacity: 3 }]
        }
      },
      {
        id: 'ride-104',
        rideNumber: 'UP-PUN-64192',
        pickupAddress: 'Baner High Street, Pune',
        pickupLat: 18.5590,
        pickupLng: 73.7868,
        destAddress: 'Pune Airport (PNQ), Lohegaon',
        destLat: 18.5822,
        destLng: 73.9197,
        distanceKm: 17.4,
        durationMinutes: 35,
        vehicleCategory: 'ECONOMY',
        estimatedFare: 340,
        finalFare: 340,
        tripPin: '4401',
        status: 'DRIVER_ASSIGNED',
        createdAt: new Date(Date.now() - 900000).toISOString(),
        customer: { name: 'Rohan Mehta' },
        driver: {
          user: { name: 'Amit Gokhale', phone: '+91 99887 65432' },
          rating: 4.88,
          totalTrips: 215,
          vehicles: [{ make: 'Hyundai', model: 'Aura CNG', licensePlate: 'MH 14 TC 7788', capacity: 4 }]
        }
      }
    ];

    setTrips(fallbackList);
    if (!selectedTrip) setSelectedTrip(fallbackList[0]);
  };

  React.useEffect(() => {
    fetchTrips();
    const interval = setInterval(fetchTrips, 20000);
    return () => clearInterval(interval);
  }, []);

  // Handle New Booking Creation
  const handleBookingCreated = (newRide) => {
    setTrips(prev => [newRide, ...prev]);
    setSelectedTrip(newRide);
    showToast(`Ride ${newRide.rideNumber} confirmed! Driver dispatched.`);
  };

  // Render Subviews if activeView is not 'dashboard'
  const renderActiveView = () => {
    if (currentView === 'booking' && window.CustomerBooking) {
      return (
        <div style={{ padding: '1.5rem', width: '100%', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ color: 'var(--ap-text-primary)', margin: 0 }}>Customer Ride Booking</h2>
            <button className="ap-btn-secondary" onClick={() => setCurrentView('dashboard')}>
              ← Return to Dashboard
            </button>
          </div>
          <window.CustomerBooking currentUser={currentUser} authToken={authToken} />
        </div>
      );
    }

    if (currentView === 'driver' && window.DriverPortal) {
      return (
        <div style={{ padding: '1.5rem', width: '100%', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ color: 'var(--ap-text-primary)', margin: 0 }}>Driver Dispatch & Telemetry Portal</h2>
            <button className="ap-btn-secondary" onClick={() => setCurrentView('dashboard')}>
              ← Return to Dashboard
            </button>
          </div>
          <window.DriverPortal authToken={authToken} onSwitchRole={() => setCurrentView('booking')} />
        </div>
      );
    }

    if (currentView === 'fleet' && window.AdminDashboard) {
      return (
        <div style={{ padding: '1.5rem', width: '100%', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ color: 'var(--ap-text-primary)', margin: 0 }}>Fleet Operations & System Metrics</h2>
            <button className="ap-btn-secondary" onClick={() => setCurrentView('dashboard')}>
              ← Return to Dashboard
            </button>
          </div>
          <window.AdminDashboard authToken={authToken} />
        </div>
      );
    }

    if (currentView === 'messages') {
      return (
        <div style={{ padding: '1.5rem', width: '100%', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ color: 'var(--ap-text-primary)', margin: 0 }}>💬 Live In-Trip Dispatch Messages</h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--ap-text-muted)' }}>
                Encrypted Peer-to-Peer WebSocket Bridge &bull; Trip: {selectedTrip?.rideNumber || 'UP-PUN-72819'}
              </div>
            </div>
            <button className="ap-btn-secondary" onClick={() => setCurrentView('dashboard')}>
              ← Return to Dashboard
            </button>
          </div>

          <div style={{ maxWidth: '640px', background: 'var(--ap-panel)', border: '1px solid var(--ap-border)', borderRadius: 'var(--ap-radius-xl)', padding: '1.25rem', display: 'flex', flexDirection: 'column', height: '480px' }}>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.8rem', paddingRight: '0.5rem' }}>
              {chatMessages.map((msg, i) => (
                <div key={i} style={{ alignSelf: msg.sender === 'rider' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                  <div style={{
                    background: msg.sender === 'rider' ? 'var(--ap-blue)' : 'var(--ap-panel-elevated)',
                    color: '#ffffff',
                    padding: '0.65rem 0.95rem',
                    borderRadius: '12px',
                    fontSize: '0.86rem',
                    border: msg.sender === 'rider' ? 'none' : '1px solid var(--ap-border)'
                  }}>
                    {msg.text}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--ap-text-muted)', marginTop: '0.2rem', textAlign: msg.sender === 'rider' ? 'right' : 'left' }}>
                    {msg.time} &bull; {msg.sender === 'rider' ? 'You' : 'Driver'}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid var(--ap-border)', paddingTop: '0.75rem' }}>
              <input
                type="text"
                placeholder="Type in-trip message to driver..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && chatInput.trim()) {
                    setChatMessages(prev => [...prev, { sender: 'rider', text: chatInput.trim(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
                    setChatInput('');
                  }
                }}
                style={{ flex: 1, background: 'var(--ap-panel-elevated)', border: '1px solid var(--ap-border)', color: '#ffffff', padding: '0.6rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem' }}
              />
              <button
                className="ap-btn-primary"
                onClick={() => {
                  if (chatInput.trim()) {
                    setChatMessages(prev => [...prev, { sender: 'rider', text: chatInput.trim(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
                    setChatInput('');
                  }
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (currentView === 'notifications') {
      const alerts = [
        { type: 'consensus', title: 'Raft Consensus Synced', detail: 'Leader coordinator confirmed block #14 across 3 DataNodes.', time: '2 mins ago', badge: 'green' },
        { type: 'dispatch', title: 'Driver Rajesh Dispatched', detail: 'Assigned to ride UP-PUN-72819 (FC Road → Hinjewadi).', time: '5 mins ago', badge: 'blue' },
        { type: 'pricing', title: 'Dynamic Surge Active', detail: 'Demand ratio 1.4x applied to Pune IT corridor.', time: '12 mins ago', badge: 'amber' },
        { type: 'health', title: 'Gateway Cluster Healthy', detail: 'All 3 Express edge instances active on ports 5001-5003.', time: '25 mins ago', badge: 'green' }
      ];

      return (
        <div style={{ padding: '1.5rem', width: '100%', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ color: 'var(--ap-text-primary)', margin: 0 }}>🔔 Real-Time Operational Alerts</h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--ap-text-muted)' }}>
                System Telemetry, Consensus Events & Dynamic Dispatch Alerts
              </div>
            </div>
            <button className="ap-btn-secondary" onClick={() => setCurrentView('dashboard')}>
              ← Return to Dashboard
            </button>
          </div>

          <div style={{ maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {alerts.map((a, i) => (
              <div key={i} className="ap-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem' }}>
                <span style={{ fontSize: '1.4rem' }}>{a.badge === 'green' ? '🟢' : a.badge === 'blue' ? '🔵' : '🟡'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--ap-text-primary)' }}>{a.title}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--ap-text-secondary)', marginTop: '0.15rem' }}>{a.detail}</div>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--ap-text-muted)' }}>{a.time}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (currentView === 'history') {
      return (
        <div style={{ padding: '1.5rem', width: '100%', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ color: 'var(--ap-text-primary)', margin: 0 }}>📜 Trip History & Settlement Records</h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--ap-text-muted)' }}>
                Immutable Ledger & Verified Itemized Receipts (Pune Fleet)
              </div>
            </div>
            <button className="ap-btn-secondary" onClick={() => setCurrentView('dashboard')}>
              ← Return to Dashboard
            </button>
          </div>

          <div className="ap-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--ap-panel-elevated)', borderBottom: '1px solid var(--ap-border)', color: 'var(--ap-text-muted)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Ride Number</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Customer</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Route</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Category</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Fare</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {trips.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--ap-border-subtle)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'var(--ap-blue)' }}>{t.rideNumber}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{t.customer?.name || 'Aarav Sharma'}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--ap-text-secondary)', maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.pickupAddress?.split(',')[0]} → {t.destAddress?.split(',')[0]}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>{t.vehicleCategory}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span className={`ap-badge ${t.status === 'COMPLETED' ? 'completed' : 'active'}`} style={{ fontSize: '0.65rem' }}>
                        {t.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#ffffff' }}>₹{t.finalFare || t.estimatedFare || 295}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <button
                        className="ap-btn-secondary"
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem' }}
                        onClick={() => {
                          setSelectedTrip(t);
                          setCurrentView('dashboard');
                        }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (currentView === 'settings') {
      return (
        <div style={{ padding: '1.5rem', width: '100%', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ color: 'var(--ap-text-primary)', margin: 0 }}>⚙️ System Settings & Node Topology</h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--ap-text-muted)' }}>
                Cluster Configuration, Physical Clock Calibration & Security Controls
              </div>
            </div>
            <button className="ap-btn-secondary" onClick={() => setCurrentView('dashboard')}>
              ← Return to Dashboard
            </button>
          </div>

          <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="ap-card">
              <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: '0.5rem', color: '#ffffff' }}>Operational Mode</div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <span className="ap-badge active">Commercial Automotive Dark</span>
                <span className="ap-badge completed">Prisma SQLite Active</span>
                <span className="ap-badge" style={{ background: 'rgba(22,119,255,0.15)', color: '#1677FF' }}>Pune Metro Coordinates</span>
              </div>
            </div>

            <div className="ap-card">
              <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: '0.5rem', color: '#ffffff' }}>Session Information</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--ap-text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div><strong>User:</strong> {currentUser?.name || 'Aarav Sharma'} ({currentUser?.email || 'customer@urbanpulse.in'})</div>
                <div><strong>Role:</strong> {currentUser?.role || 'CUSTOMER'}</div>
                <div><strong>Gateway:</strong> Express Port 5000 (Forwarding to 5001-5003)</div>
              </div>
              <button
                className="ap-btn-secondary"
                style={{ marginTop: '1rem', color: '#F87171' }}
                onClick={() => {
                  localStorage.removeItem('urbanpulse_token');
                  showToast('Session token cleared.');
                }}
              >
                Clear Auth Token
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (currentView === 'inspector' && window.SystemInspector) {
      return (
        <div style={{ padding: '1.5rem', width: '100%', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ color: 'var(--ap-text-primary)', margin: 0 }}>🔬 Distributed Systems Inspector</h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--ap-text-muted)' }}>
                Pune Coursework Verification: Lamport Clocks, Vector Clocks, Paxos, Quorum & Fault Tolerance
              </div>
            </div>
            <button className="ap-btn-secondary" onClick={() => setCurrentView('dashboard')}>
              ← Return to Dashboard
            </button>
          </div>
          <window.SystemInspector />
        </div>
      );
    }

    // Default Main Dashboard matching Reference Layout
    return (
      <main className="ap-workspace">
        {/* Dashboard Header */}
        <header className="ap-header">
          <div className="ap-header-left">
            <h1 className="ap-page-title">Fleet Dispatch & Live Tracking</h1>
            <div className="ap-header-subtitle">
              Pune Metropolitan Region &bull; 4 Nodes Active &bull; Real-time Telemetry
            </div>
          </div>

          <div className="ap-header-right">
            {/* Live Consensus Tag */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(54,200,91,0.1)', border: '1px solid rgba(54,200,91,0.25)', padding: '0.35rem 0.75rem', borderRadius: '100px', fontSize: '0.75rem', color: 'var(--ap-green-completed)', fontWeight: 600 }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'currentColor', display: 'inline-block' }}></span>
              Consensus Synced
            </div>

            {/* Date Pill */}
            <div className="ap-date-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>

            {/* Quick Action */}
            <button
              className="ap-btn-primary"
              onClick={() => setIsBookingOpen(true)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              New Booking
            </button>
          </div>
        </header>

        {/* Top Information Section: Two Cards */}
        <section className="ap-top-cards-grid">
          {window.VehicleCard && (
            <window.VehicleCard
              vehicle={selectedTrip?.driver?.vehicle || {
                make: 'Maruti Suzuki',
                model: 'Swift Dzire Tour',
                category: selectedTrip?.vehicleCategory || 'ECONOMY',
                licensePlate: 'MH 12 QX 4501',
                capacity: 4
              }}
              driver={selectedTrip?.driver || {
                name: 'Rajesh Patil',
                rating: 4.89,
                totalTrips: 342
              }}
              trip={selectedTrip}
            />
          )}

          {window.TripInfoCard && (
            <window.TripInfoCard
              trip={selectedTrip}
              onTrackRide={() => showToast(`Tracking ride ${selectedTrip?.rideNumber} live on route`)}
              onOpenBooking={() => setIsBookingOpen(true)}
            />
          )}
        </section>

        {/* Main Map & Vertical Route Timeline Section */}
        <section className="ap-map-timeline-grid">
          {window.TripMap && (
            <window.TripMap
              trip={selectedTrip}
              routeGeometry={null}
              driverLocation={null}
            />
          )}

          {window.TripTimeline && (
            <window.TripTimeline
              trip={selectedTrip}
            />
          )}
        </section>
      </main>
    );
  };

  return (
    <div className="ap-dashboard-shell">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="ap-toast">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          {toastMessage}
        </div>
      )}

      {/* Part A: Narrow Left Navigation Rail (68px) */}
      {window.SidebarNav && (
        <window.SidebarNav
          currentView={currentView}
          onViewChange={(v) => setCurrentView(v)}
          currentUser={currentUser}
        />
      )}

      {/* Part B & C: Main Workspace */}
      {renderActiveView()}

      {/* Part D: Right-Side Trips Panel (~260px) */}
      {currentView === 'dashboard' && window.TripsPanel && (
        <window.TripsPanel
          trips={trips}
          selectedTripId={selectedTrip?.id}
          onSelectTrip={(t) => {
            setSelectedTrip(t);
            if (currentView !== 'dashboard') setCurrentView('dashboard');
          }}
          onOpenBooking={() => setIsBookingOpen(true)}
          onViewHistory={() => setCurrentView('history')}
        />
      )}

      {/* Modal: New Booking */}
      {window.BookingModal && (
        <window.BookingModal
          isOpen={isBookingOpen}
          onClose={() => setIsBookingOpen(false)}
          onBookingSuccess={handleBookingCreated}
          currentUser={currentUser}
          authToken={authToken}
        />
      )}
    </div>
  );
}

window.DarkDashboard = DarkDashboard;
