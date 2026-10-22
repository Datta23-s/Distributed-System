// UrbanPulse Dispatch — Driver Portal & Dispatch Interface
// Complies with Sections 9, 10, 11 of UrbanPulse Master Spec

function DriverPortal({ authToken, onSwitchRole }) {
  const [driverProfile, setDriverProfile] = React.useState(null);
  const [isAvailable, setIsAvailable] = React.useState(true);
  const [incomingOffer, setIncomingOffer] = React.useState(null);
  const [countdownSeconds, setCountdownSeconds] = React.useState(30);
  const [activeRide, setActiveRide] = React.useState(null);
  const [tripPinInput, setTripPinInput] = React.useState('');
  const [pinError, setPinError] = React.useState('');
  const [earningsData, setEarningsData] = React.useState(null);
  const [driverToken, setDriverToken] = React.useState(null);
  const [selectedDriverEmail, setSelectedDriverEmail] = React.useState('driver1@urbanpulse.in');

  const countdownIntervalRef = React.useRef(null);
  const socketRef = React.useRef(null);

  // Authenticate as Driver
  const loginDriver = async (email) => {
    setSelectedDriverEmail(email);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'Password@123' })
      });
      const data = await res.json();
      if (data.success) {
        setDriverToken(data.token);
        fetchDriverProfile(data.token);
        fetchEarnings(data.token);
      }
    } catch (e) {
      console.error('Driver login error:', e);
    }
  };

  React.useEffect(() => {
    loginDriver('driver1@urbanpulse.in');
  }, []);

  const fetchDriverProfile = async (token) => {
    try {
      const res = await fetch('/api/v1/driver/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setDriverProfile(data.driver);
        setIsAvailable(data.driver.status === 'AVAILABLE');
      }
    } catch (e) { }
  };

  const fetchEarnings = async (token) => {
    try {
      const res = await fetch('/api/v1/driver/earnings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setEarningsData(data);
    } catch (e) { }
  };

  // Poll for incoming offers and active rides
  const checkPendingOffers = async () => {
    if (!driverToken) return;
    try {
      const res = await fetch('/api/v1/driver/offers', {
        headers: { 'Authorization': `Bearer ${driverToken}` }
      });
      const data = await res.json();
      if (data.success && data.offer && (!incomingOffer || incomingOffer.id !== data.offer.id)) {
        setIncomingOffer(data.offer);
        setCountdownSeconds(30);
      }
    } catch (e) { }
  };

  React.useEffect(() => {
    const timer = setInterval(checkPendingOffers, 2000);
    return () => clearInterval(timer);
  }, [driverToken, incomingOffer]);

  // Countdown timer for incoming offer
  React.useEffect(() => {
    if (!incomingOffer) {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      return;
    }

    countdownIntervalRef.current = setInterval(() => {
      setCountdownSeconds(prev => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          setIncomingOffer(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownIntervalRef.current);
  }, [incomingOffer]);

  // WebSocket for Live Driver Events
  React.useEffect(() => {
    if (!driverToken || !driverProfile) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    socketRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'AUTHENTICATE',
        token: driverToken
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'INCOMING_RIDE_OFFER') {
          setIncomingOffer({
            id: msg.data.assignmentId,
            ride: {
              id: msg.data.rideId,
              rideNumber: msg.data.rideNumber,
              pickupAddress: msg.data.pickupAddress,
              destAddress: msg.data.destAddress,
              distanceKm: msg.data.distanceKm,
              estimatedFare: msg.data.estimatedFare,
              customer: { name: msg.data.customerName }
            }
          });
          setCountdownSeconds(30);
        } else if (msg.type === 'OFFER_TIMED_OUT') {
          setIncomingOffer(null);
        }
      } catch (e) { }
    };

    return () => {
      if (ws.readyState === 1) ws.close();
    };
  }, [driverToken, driverProfile?.id]);

  // Toggle Availability
  const handleToggleAvailability = async () => {
    const nextStatus = isAvailable ? 'OFFLINE' : 'AVAILABLE';
    try {
      const res = await fetch('/api/v1/driver/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverToken}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (data.success) {
        setIsAvailable(nextStatus === 'AVAILABLE');
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert('Error updating status');
    }
  };

  // Accept Offer
  const handleAcceptOffer = async () => {
    if (!incomingOffer) return;
    try {
      const res = await fetch(`/api/v1/driver/assignments/${incomingOffer.id}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverToken}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setActiveRide(data.ride);
        setIncomingOffer(null);
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert('Failed to accept offer');
    }
  };

  // Reject Offer
  const handleRejectOffer = async () => {
    if (!incomingOffer) return;
    try {
      await fetch(`/api/v1/driver/assignments/${incomingOffer.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverToken}`
        }
      });
      setIncomingOffer(null);
    } catch (e) { }
  };

  // Mark En Route to Pickup
  const handleMarkArriving = async () => {
    if (!activeRide) return;
    try {
      const res = await fetch(`/api/v1/driver/rides/${activeRide.id}/arriving`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverToken}`
        }
      });
      const data = await res.json();
      if (data.success) setActiveRide(prev => ({ ...prev, status: 'DRIVER_ARRIVING' }));
    } catch (e) { }
  };

  // Mark Arrived at Pickup
  const handleMarkArrived = async () => {
    if (!activeRide) return;
    try {
      const res = await fetch(`/api/v1/driver/rides/${activeRide.id}/arrived`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverToken}`
        }
      });
      const data = await res.json();
      if (data.success) setActiveRide(prev => ({ ...prev, status: 'DRIVER_ARRIVED' }));
    } catch (e) { }
  };

  // Verify PIN & Start Trip
  const handleVerifyPinAndStart = async () => {
    if (!activeRide || !tripPinInput) return;
    setPinError('');
    try {
      const res = await fetch(`/api/v1/driver/rides/${activeRide.id}/verify-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverToken}`
        },
        body: JSON.stringify({ tripPin: tripPinInput.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setActiveRide(prev => ({ ...prev, status: 'IN_PROGRESS' }));
        setTripPinInput('');
      } else {
        setPinError(data.error || 'Incorrect Trip PIN');
      }
    } catch (e) {
      setPinError('PIN verification failed');
    }
  };

  // Complete Trip
  const handleCompleteTrip = async () => {
    if (!activeRide) return;
    try {
      const res = await fetch(`/api/v1/driver/rides/${activeRide.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverToken}`
        }
      });
      const data = await res.json();
      if (data.success) {
        alert(`Trip completed! Final fare: ₹${data.ride.finalFare}`);
        setActiveRide(null);
        fetchEarnings(driverToken);
      }
    } catch (e) {
      alert('Error completing trip');
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '1.5rem auto', padding: '0 1rem' }}>
      {/* Driver Persona Switcher Header */}
      <div style={{ background: '#ffffff', border: '1px solid var(--up-border)', borderRadius: '14px', padding: '1.25rem', marginBottom: '1.5rem', boxShadow: 'var(--up-shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--up-blue)', textTransform: 'uppercase' }}>URBANPULSE DRIVER CONSOLE</span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--up-navy)' }}>
              {driverProfile?.user.name || 'Driver Console'}
            </h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--up-text-muted)', marginTop: '0.2rem' }}>
              Vehicle: <b>{driverProfile?.vehicles[0]?.make} {driverProfile?.vehicles[0]?.model}</b> &bull; License Plate: <span className="up-plate-badge">{driverProfile?.vehicles[0]?.licensePlate}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Quick Switch Persona */}
            <select
              value={selectedDriverEmail}
              onChange={(e) => loginDriver(e.target.value)}
              style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid var(--up-border)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--up-slate)' }}
            >
              <option value="driver1@urbanpulse.in">Rajesh Patil (Swift Dzire - Cab)</option>
              <option value="driver2@urbanpulse.in">Santosh Jadhav (Bajaj RE - Auto)</option>
              <option value="driver3@urbanpulse.in">Vikram Deshmukh (Splendor - Bike)</option>
            </select>

            {/* Online / Offline Toggle Button */}
            <button
              onClick={handleToggleAvailability}
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: '999px',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                background: isAvailable ? '#10b981' : '#64748b',
                color: '#ffffff',
                boxShadow: isAvailable ? '0 0 12px rgba(16, 185, 129, 0.4)' : 'none'
              }}
            >
              {isAvailable ? '🟢 ONLINE (ACCEPTING)' : '⚪ GO ONLINE'}
            </button>
          </div>
        </div>
      </div>

      {/* Active Trip Workflow Panel */}
      {activeRide && (
        <div style={{ background: '#ffffff', border: '2px solid var(--up-blue)', borderRadius: '14px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: 'var(--up-shadow-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--up-navy)' }}>
              Active Ride: {activeRide.rideNumber}
            </span>
            <span className={`up-status-badge ${activeRide.status.toLowerCase()}`}>
              {activeRide.status.replace('_', ' ')}
            </span>
          </div>

          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.9rem', marginBottom: '0.4rem' }}><b>Passenger:</b> {activeRide.customer?.name || 'Customer'}</div>
            <div style={{ fontSize: '0.88rem', color: 'var(--up-slate)', marginBottom: '0.3rem' }}><b>Pickup:</b> {activeRide.pickupAddress}</div>
            <div style={{ fontSize: '0.88rem', color: 'var(--up-slate)' }}><b>Destination:</b> {activeRide.destAddress}</div>
            <div style={{ fontSize: '0.88rem', color: '#059669', fontWeight: 700, marginTop: '0.5rem' }}>Estimated Fare: ₹{activeRide.estimatedFare}</div>
          </div>

          {/* Workflow Step Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {activeRide.status === 'DRIVER_ASSIGNED' && (
              <button className="up-btn-primary" onClick={handleMarkArriving}>
                🚗 Start Heading to Pickup (Mark En Route)
              </button>
            )}

            {(activeRide.status === 'DRIVER_ASSIGNED' || activeRide.status === 'DRIVER_ARRIVING') && (
              <button className="up-btn-primary" onClick={handleMarkArrived} style={{ background: '#059669' }}>
                📍 Arrived at Pickup Location
              </button>
            )}

            {activeRide.status === 'DRIVER_ARRIVED' && (
              <div style={{ background: '#f0f9ff', padding: '1.25rem', borderRadius: '10px', border: '1px solid #bae6fd' }}>
                <h4 style={{ color: 'var(--up-navy)', marginBottom: '0.5rem' }}>Verify Passenger 4-Digit PIN</h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--up-text-muted)', marginBottom: '0.75rem' }}>
                  Ask the passenger for the 4-digit verification code shown on their screen.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="e.g. 8492"
                    value={tripPinInput}
                    onChange={(e) => setTripPinInput(e.target.value)}
                    style={{ fontSize: '1.4rem', letterSpacing: '0.2em', textAlign: 'center', width: '140px', padding: '0.5rem', borderRadius: '8px', border: '1.5px solid var(--up-border)', fontWeight: 800 }}
                  />
                  <button className="up-btn-primary" onClick={handleVerifyPinAndStart} style={{ flex: 1, background: '#059669' }}>
                    Verify PIN & Start Trip
                  </button>
                </div>
                {pinError && <div style={{ color: '#dc2626', fontSize: '0.82rem', marginTop: '0.5rem', fontWeight: 600 }}>{pinError}</div>}
              </div>
            )}

            {activeRide.status === 'IN_PROGRESS' && (
              <button className="up-btn-primary" onClick={handleCompleteTrip} style={{ background: '#059669', fontSize: '1.1rem', padding: '1rem' }}>
                🏁 Arrived at Destination & Complete Trip
              </button>
            )}
          </div>
        </div>
      )}

      {/* Driver Earnings Summary Grid */}
      <div className="up-admin-grid">
        <div className="up-stat-card">
          <div className="up-stat-label">Total Earnings</div>
          <div className="up-stat-val" style={{ color: '#059669' }}>
            ₹{earningsData?.summary.totalEarnings.toLocaleString('en-IN') || 0}
          </div>
        </div>
        <div className="up-stat-card">
          <div className="up-stat-label">Completed Trips</div>
          <div className="up-stat-val">{earningsData?.summary.totalTrips || 0}</div>
        </div>
        <div className="up-stat-card">
          <div className="up-stat-label">Driver Rating</div>
          <div className="up-stat-val">⭐ {earningsData?.summary.rating || '5.0'}</div>
        </div>
      </div>

      {/* Incoming Ride Offer Modal */}
      {incomingOffer && (
        <div className="up-driver-offer-modal">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, color: 'var(--up-blue)', fontSize: '0.85rem' }}>NEW RIDE OFFER</span>
            <span style={{ fontWeight: 700, color: '#dc2626', fontSize: '0.9rem' }}>⏱️ {countdownSeconds}s</span>
          </div>

          <div className="up-countdown-bar">
            <div className="up-countdown-progress" style={{ width: `${(countdownSeconds / 30) * 100}%` }}></div>
          </div>

          <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--up-navy)' }}>
              ₹{incomingOffer.ride.estimatedFare} &bull; {incomingOffer.ride.distanceKm} km
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--up-text-muted)' }}>
              Customer: <b>{incomingOffer.ride.customer?.name}</b>
            </div>
            <div style={{ fontSize: '0.85rem' }}>
              <b>Pickup:</b> {incomingOffer.ride.pickupAddress}
            </div>
            <div style={{ fontSize: '0.85rem' }}>
              <b>Dropoff:</b> {incomingOffer.ride.destAddress}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button
              onClick={handleRejectOffer}
              style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#f1f5f9', fontWeight: 700, cursor: 'pointer', color: 'var(--up-slate)' }}
            >
              Decline
            </button>
            <button
              onClick={handleAcceptOffer}
              style={{ flex: 2, padding: '0.75rem', borderRadius: '10px', border: 'none', background: '#10b981', color: '#ffffff', fontWeight: 700, cursor: 'pointer', fontSize: '1rem', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}
            >
              Accept Ride
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
