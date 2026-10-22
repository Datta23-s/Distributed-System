// UrbanPulse Dispatch — Customer Booking & Live Ride Tracking
// Complies with Sections 4, 6, 7, 8, 11, 14 of UrbanPulse Master Spec

function CustomerBooking({ currentUser, authToken, onAuthRequired }) {
  const [pickup, setPickup] = React.useState({
    name: 'FC Road, Shivajinagar',
    address: 'FC Road, Shivajinagar, Pune 411005',
    lat: 18.5314,
    lng: 73.8446
  });
  const [destination, setDestination] = React.useState({
    name: 'Hinjewadi IT Park Phase 1',
    address: 'Rajiv Gandhi Infotech Park, Hinjewadi, Pune 411057',
    lat: 18.5912,
    lng: 73.7389
  });

  const [pickupQuery, setPickupQuery] = React.useState('FC Road, Shivajinagar');
  const [destQuery, setDestQuery] = React.useState('Hinjewadi IT Park Phase 1');
  const [suggestions, setSuggestions] = React.useState([]);
  const [activeInput, setActiveInput] = React.useState(null); // 'pickup' | 'dest'

  const [routeInfo, setRouteInfo] = React.useState(null);
  const [quotes, setQuotes] = React.useState([]);
  const [selectedQuote, setSelectedQuote] = React.useState(null);
  const [loadingQuotes, setLoadingQuotes] = React.useState(false);
  const [activeRide, setActiveRide] = React.useState(null);
  const [showReceiptModal, setShowReceiptModal] = React.useState(false);
  const [completedReceipt, setCompletedReceipt] = React.useState(null);
  const [showSafetyModal, setShowSafetyModal] = React.useState(false);
  const [showRatingModal, setShowRatingModal] = React.useState(false);
  const [ratingScore, setRatingScore] = React.useState(5);
  const [ratingFeedback, setRatingFeedback] = React.useState('');
  const [customerTab, setCustomerTab] = React.useState('booking'); // 'booking' | 'history' | 'saved'
  const [rideHistory, setRideHistory] = React.useState([]);

  const mapInstanceRef = React.useRef(null);
  const markersRef = React.useRef({ pickup: null, dest: null, route: null, driver: null });
  const socketRef = React.useRef(null);

  // Initialize Leaflet Map centered on Pune
  React.useEffect(() => {
    const mapContainer = document.getElementById('leaflet-map');
    if (!mapContainer || !window.L) return;

    if (mapContainer._leaflet_id) {
      mapContainer._leaflet_id = null;
    }

    const map = window.L.map('leaflet-map', {
      zoomControl: true
    }).setView([18.5314, 73.8446], 13);

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors | UrbanPulse Pune'
    }).addTo(map);

    mapInstanceRef.current = map;

    const timer = setTimeout(() => {
      if (map) map.invalidateSize();
    }, 250);

    // Handle map clicks to set destination
    map.on('click', async (e) => {
      try {
        const res = await fetch(`/api/v1/maps/reverse?lat=${e.latlng.lat}&lng=${e.latlng.lng}`);
        const data = await res.json();
        if (data.result) {
          setDestination(data.result);
          setDestQuery(data.result.name);
        }
      } catch (err) {
        console.error('Reverse geocode error:', err);
      }
    });

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Map Markers and Route Polyline
  React.useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.L) return;

    // Pickup Marker
    if (pickup && pickup.lat && pickup.lng) {
      if (markersRef.current.pickup) markersRef.current.pickup.remove();
      markersRef.current.pickup = window.L.marker([pickup.lat, pickup.lng], {
        title: 'Pickup: ' + pickup.name
      }).addTo(map).bindPopup(`<b>Pickup:</b> ${pickup.name}`).openPopup();
    }

    // Destination Marker
    if (destination && destination.lat && destination.lng) {
      if (markersRef.current.dest) markersRef.current.dest.remove();
      markersRef.current.dest = window.L.marker([destination.lat, destination.lng], {
        title: 'Destination: ' + destination.name
      }).addTo(map).bindPopup(`<b>Destination:</b> ${destination.name}`);
    }

    // Route Geometry
    if (routeInfo && routeInfo.routeGeometry && routeInfo.routeGeometry.length > 0) {
      if (markersRef.current.route) markersRef.current.route.remove();
      markersRef.current.route = window.L.polyline(routeInfo.routeGeometry, {
        color: '#2563eb',
        weight: 5,
        opacity: 0.85,
        smoothFactor: 1
      }).addTo(map);

      map.fitBounds(markersRef.current.route.getBounds(), { padding: [40, 40] });
    }
  }, [pickup, destination, routeInfo]);

  // Fetch Fare Quotes when pickup/destination change
  const fetchQuotes = async () => {
    if (!pickup.lat || !destination.lat) return;
    setLoadingQuotes(true);
    try {
      const res = await fetch('/api/v1/fares/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupAddress: pickup.address || pickup.name,
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          destAddress: destination.address || destination.name,
          destLat: destination.lat,
          destLng: destination.lng,
          customerId: currentUser?.id
        })
      });
      const data = await res.json();
      if (data.success) {
        setRouteInfo(data.route);
        setQuotes(data.quotes);
        if (data.quotes.length > 0) {
          // Select Economy by default
          const defaultOpt = data.quotes.find(q => q.category === 'ECONOMY') || data.quotes[0];
          setSelectedQuote(defaultOpt);
        }
      }
    } catch (err) {
      console.error('Fetch quotes error:', err);
    } finally {
      setLoadingQuotes(false);
    }
  };

  React.useEffect(() => {
    fetchQuotes();
  }, [pickup.lat, destination.lat]);

  // Check Active Ride on Mount
  React.useEffect(() => {
    if (!authToken) return;
    fetch('/api/v1/rides/active', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.ride) {
          setActiveRide(data.ride);
        }
      })
      .catch(() => {});
  }, [authToken]);

  // WebSocket Listener for Real-Time Ride Updates
  React.useEffect(() => {
    if (!authToken || !currentUser) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    socketRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'AUTHENTICATE',
        token: authToken
      }));
      if (activeRide) {
        ws.send(JSON.stringify({
          type: 'SUBSCRIBE_RIDE',
          rideId: activeRide.id
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'RIDE_STATUS_UPDATED') {
          setActiveRide(prev => prev ? { ...prev, status: msg.data.status } : null);
        } else if (msg.type === 'RIDE_ASSIGNED') {
          setActiveRide(prev => prev ? {
            ...prev,
            status: 'DRIVER_ASSIGNED',
            driver: { user: { name: msg.data.driver.name, phone: msg.data.driver.phone }, vehicles: [msg.data.driver.vehicle], rating: msg.data.driver.rating },
            tripPin: msg.data.tripPin
          } : null);
        } else if (msg.type === 'TRIP_STARTED') {
          setActiveRide(prev => prev ? { ...prev, status: 'IN_PROGRESS' } : null);
        } else if (msg.type === 'TRIP_COMPLETED') {
          setActiveRide(prev => prev ? { ...prev, status: 'COMPLETED' } : null);
          // Fetch receipt
          if (activeRide) {
            fetch(`/api/v1/customer/receipt/${activeRide.id}`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            })
              .then(r => r.json())
              .then(d => {
                if (d.receipt) {
                  setCompletedReceipt(d.receipt);
                  setShowReceiptModal(true);
                }
              });
          }
        } else if (msg.type === 'DRIVER_LOCATION_UPDATE') {
          // Update driver live marker on Leaflet map
          const map = mapInstanceRef.current;
          if (map && window.L && msg.data.latitude && msg.data.longitude) {
            if (markersRef.current.driver) markersRef.current.driver.remove();
            markersRef.current.driver = window.L.marker([msg.data.latitude, msg.data.longitude], {
              icon: window.L.divIcon({
                className: 'driver-car-icon',
                html: '<div style="background:#0b132b;color:#fff;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);font-size:16px;">🚗</div>'
              })
            }).addTo(map);
          }
        }
      } catch (e) { }
    };

    return () => {
      if (ws.readyState === 1) ws.close();
    };
  }, [authToken, currentUser, activeRide?.id]);

  // Autocomplete search
  const handleSearch = async (text, type) => {
    if (type === 'pickup') setPickupQuery(text);
    if (type === 'dest') setDestQuery(text);
    setActiveInput(type);

    if (text.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const res = await fetch(`/api/v1/maps/search?q=${encodeURIComponent(text)}`);
      const data = await res.json();
      if (data.results) setSuggestions(data.results);
    } catch (e) { }
  };

  const selectSuggestion = (sugg) => {
    if (activeInput === 'pickup') {
      setPickup(sugg);
      setPickupQuery(sugg.name);
    } else {
      setDestination(sugg);
      setDestQuery(sugg.name);
    }
    setSuggestions([]);
    setActiveInput(null);
  };

  // Book Ride
  const handleBookRide = async () => {
    if (!selectedQuote) return;
    try {
      const res = await fetch('/api/v1/rides/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          quoteId: selectedQuote.quoteId,
          vehicleCategory: selectedQuote.category,
          pickupAddress: pickup.address || pickup.name,
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          destAddress: destination.address || destination.name,
          destLat: destination.lat,
          destLng: destination.lng,
          distanceKm: selectedQuote.distanceKm,
          durationMinutes: selectedQuote.durationMinutes,
          estimatedFare: selectedQuote.totalFare
        })
      });

      const data = await res.json();
      if (data.success) {
        setActiveRide({
          id: data.rideId,
          rideNumber: data.rideNumber,
          status: 'SEARCHING',
          vehicleCategory: data.vehicleCategory,
          pickupAddress: data.pickupAddress,
          destAddress: data.destAddress,
          estimatedFare: data.estimatedFare,
          tripPin: data.tripPin
        });

        if (socketRef.current && socketRef.current.readyState === 1) {
          socketRef.current.send(JSON.stringify({
            type: 'SUBSCRIBE_RIDE',
            rideId: data.rideId
          }));
        }
      } else {
        alert(data.error || 'Failed to book ride');
      }
    } catch (err) {
      console.error('Booking error:', err);
    }
  };

  // Cancel Active Ride
  const handleCancelRide = async () => {
    if (!activeRide) return;
    const reason = prompt('Please select or enter reason for cancellation:', 'Changed my mind');
    if (!reason) return;

    try {
      const res = await fetch(`/api/v1/rides/${activeRide.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (data.success) {
        setActiveRide(null);
        alert('Ride cancelled successfully.');
      }
    } catch (e) {
      alert('Failed to cancel ride');
    }
  };

  // Submit Driver Rating
  const handleSubmitRating = async () => {
    if (!completedReceipt || !activeRide) return;
    try {
      await fetch(`/api/v1/rides/${activeRide.id}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ score: ratingScore, feedback: ratingFeedback })
      });
      setShowRatingModal(false);
      setShowReceiptModal(false);
      setActiveRide(null);
      alert('Thank you for rating your driver!');
    } catch (e) {
      alert('Error submitting rating');
    }
  };

  // Load Ride History
  const loadHistory = async () => {
    try {
      const res = await fetch('/api/v1/customer/rides', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.rides) setRideHistory(data.rides);
    } catch (e) { }
  };

  return (
    <div className="up-booking-layout">
      {/* LEFT SIDEBAR: Search, Vehicles, or Active Trip */}
      <div className="up-booking-sidebar">
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--up-border)', gap: '1rem', paddingBottom: '0.5rem' }}>
          <button
            onClick={() => setCustomerTab('booking')}
            style={{
              background: 'none', border: 'none', fontWeight: customerTab === 'booking' ? 700 : 500,
              color: customerTab === 'booking' ? 'var(--up-blue)' : 'var(--up-text-muted)',
              borderBottom: customerTab === 'booking' ? '2px solid var(--up-blue)' : 'none',
              paddingBottom: '0.4rem', cursor: 'pointer'
            }}
          >
            🚗 Book a Ride
          </button>
          <button
            onClick={() => { setCustomerTab('history'); loadHistory(); }}
            style={{
              background: 'none', border: 'none', fontWeight: customerTab === 'history' ? 700 : 500,
              color: customerTab === 'history' ? 'var(--up-blue)' : 'var(--up-text-muted)',
              borderBottom: customerTab === 'history' ? '2px solid var(--up-blue)' : 'none',
              paddingBottom: '0.4rem', cursor: 'pointer'
            }}
          >
            📋 Ride History
          </button>
        </div>

        {customerTab === 'history' ? (
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--up-navy)' }}>Your Past Trips</h3>
            {rideHistory.length === 0 ? (
              <p style={{ color: 'var(--up-text-muted)', fontSize: '0.9rem' }}>No past trips found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {rideHistory.map(r => (
                  <div key={r.id} style={{ background: '#f8fafc', border: '1px solid var(--up-border)', borderRadius: '10px', padding: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.92rem' }}>
                      <span>{r.vehicleCategory} &bull; ₹{r.finalFare || r.estimatedFare}</span>
                      <span style={{ fontSize: '0.75rem', color: r.status === 'COMPLETED' ? '#059669' : '#dc2626' }}>{r.status}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--up-text-muted)', marginTop: '0.35rem' }}>
                      From: {r.pickupAddress}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--up-text-muted)' }}>
                      To: {r.destAddress}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.4rem' }}>
                      {new Date(r.createdAt).toLocaleString('en-IN')} &bull; Ref: {r.rideNumber}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeRide ? (
          /* ACTIVE TRIP MONITORING VIEW */
          <div className="up-active-ride-card">
            <div className="up-status-header">
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--up-text-muted)', fontWeight: 600 }}>RIDE NUMBER</span>
                <div style={{ fontWeight: 800, color: 'var(--up-navy)' }}>{activeRide.rideNumber}</div>
              </div>
              <span className={`up-status-badge ${activeRide.status.toLowerCase()}`}>
                {activeRide.status === 'SEARCHING' && '⚡ '}
                {activeRide.status.replace('_', ' ')}
              </span>
            </div>

            {/* 4-Digit Trip PIN Box */}
            <div className="up-pin-box">
              <div className="up-pin-label">Trip Verification PIN</div>
              <div className="up-pin-code">{activeRide.tripPin || '••••'}</div>
              <div className="up-pin-hint">Share this 4-digit code with your driver before starting the trip.</div>
            </div>

            {/* Driver Details if Assigned */}
            {activeRide.driver ? (
              <div className="up-driver-strip">
                <div className="up-driver-avatar">
                  {activeRide.driver.user.name.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="up-driver-name">{activeRide.driver.user.name} &bull; ⭐ {activeRide.driver.rating || '4.9'}</div>
                  <div className="up-driver-vehicle">
                    {activeRide.driver.vehicles[0]?.make} {activeRide.driver.vehicles[0]?.model} &bull; <span className="up-plate-badge">{activeRide.driver.vehicles[0]?.licensePlate}</span>
                  </div>
                </div>
                <a href={`tel:${activeRide.driver.user.phone}`} style={{ textDecoration: 'none', background: '#e0f2fe', padding: '0.4rem 0.6rem', borderRadius: '8px', fontSize: '1.1rem' }}>
                  📞
                </a>
              </div>
            ) : (
              <div style={{ padding: '0.75rem', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fef3c7', fontSize: '0.85rem', color: '#92400e' }}>
                ⏳ Connecting to nearby Pune {activeRide.vehicleCategory} drivers...
              </div>
            )}

            {/* Trip Details */}
            <div style={{ fontSize: '0.85rem', borderTop: '1px solid var(--up-border)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div><b>Pickup:</b> {activeRide.pickupAddress}</div>
              <div><b>Destination:</b> {activeRide.destAddress}</div>
              <div><b>Estimated Fare:</b> ₹{activeRide.estimatedFare} (Cash / UPI)</div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => setShowSafetyModal(true)}
                style={{ flex: 1, padding: '0.65rem', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem' }}
              >
                🛡️ Safety & Help
              </button>
              {activeRide.status !== 'COMPLETED' && activeRide.status !== 'IN_PROGRESS' && (
                <button
                  onClick={handleCancelRide}
                  style={{ flex: 1, padding: '0.65rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem' }}
                >
                  Cancel Ride
                </button>
              )}
            </div>
          </div>
        ) : (
          /* STANDARD BOOKING FORM */
          <>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--up-navy)', letterSpacing: '-0.02em', marginBottom: '0.35rem' }}>
                Where to in Pune?
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--up-text-muted)' }}>
                Reliable point-to-point dispatch across Pune Metro.
              </p>
            </div>

            {/* Address Search Box */}
            <div className="up-address-box">
              <div className="up-input-row">
                <div className="up-input-dot pickup"></div>
                <input
                  className="up-input-field"
                  placeholder="Enter pickup location"
                  value={pickupQuery}
                  onChange={(e) => handleSearch(e.target.value, 'pickup')}
                  onFocus={() => setActiveInput('pickup')}
                />
              </div>

              <div style={{ height: '1px', background: 'var(--up-border)', margin: '0 0.5rem' }}></div>

              <div className="up-input-row">
                <div className="up-input-dot destination"></div>
                <input
                  className="up-input-field"
                  placeholder="Enter destination location"
                  value={destQuery}
                  onChange={(e) => handleSearch(e.target.value, 'dest')}
                  onFocus={() => setActiveInput('dest')}
                />
              </div>

              {/* Suggestions Dropdown */}
              {suggestions.length > 0 && (
                <div className="up-suggestions-list">
                  {suggestions.map((s, idx) => (
                    <div key={idx} className="up-suggestion-item" onClick={() => selectSuggestion(s)}>
                      <div className="up-suggestion-name">{s.name}</div>
                      <div className="up-suggestion-addr">{s.address}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Destination Shortcut Chips */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  setDestination({ name: 'Hinjewadi IT Park Phase 1', address: 'Hinjewadi Phase 1, Pune', lat: 18.5912, lng: 73.7389 });
                  setDestQuery('Hinjewadi IT Park Phase 1');
                }}
                style={{ padding: '0.35rem 0.65rem', background: '#f1f5f9', border: '1px solid var(--up-border)', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', color: 'var(--up-slate)' }}
              >
                🏢 Hinjewadi IT Park
              </button>
              <button
                onClick={() => {
                  setDestination({ name: 'Pune International Airport (PNQ)', address: 'Lohegaon, Pune 411032', lat: 18.5822, lng: 73.9197 });
                  setDestQuery('Pune Airport (PNQ)');
                }}
                style={{ padding: '0.35rem 0.65rem', background: '#f1f5f9', border: '1px solid var(--up-border)', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', color: 'var(--up-slate)' }}
              >
                ✈️ Pune Airport
              </button>
              <button
                onClick={() => {
                  setDestination({ name: 'Koregaon Park (Lane 7)', address: 'North Main Road, Pune', lat: 18.5362, lng: 73.8940 });
                  setDestQuery('Koregaon Park');
                }}
                style={{ padding: '0.35rem 0.65rem', background: '#f1f5f9', border: '1px solid var(--up-border)', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', color: 'var(--up-slate)' }}
              >
                ☕ Koregaon Park
              </button>
            </div>

            {/* Vehicle Category Selector */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--up-navy)' }}>Select Vehicle</span>
                {routeInfo && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--up-text-muted)' }}>
                    {routeInfo.distanceKm} km &bull; ~{routeInfo.durationMinutes} mins
                  </span>
                )}
              </div>

              {loadingQuotes ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--up-text-muted)', fontSize: '0.9rem' }}>
                  Calculating fares across Pune road network...
                </div>
              ) : (
                <div className="up-vehicle-grid">
                  {quotes.map(q => {
                    const isSelected = selectedQuote?.category === q.category;
                    const icon = q.category === 'BIKE' ? '🏍️' : q.category === 'AUTO' ? '🛺' : q.category === 'PREMIUM' ? '✨' : '🚗';
                    return (
                      <div
                        key={q.category}
                        className={`up-vehicle-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedQuote(q)}
                      >
                        <div className="up-vehicle-left">
                          <div className="up-vehicle-icon">{icon}</div>
                          <div>
                            <div className="up-vehicle-title">
                              {q.name}
                              <span className="up-vehicle-capacity">👤 {q.capacity}</span>
                            </div>
                            <div className="up-vehicle-eta">ETA: {q.etaMinutes} mins &bull; {q.description}</div>
                          </div>
                        </div>
                        <div>
                          <div className="up-vehicle-price">₹{q.totalFare}</div>
                          <div className="up-vehicle-distance">{q.distanceKm} km</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Request Button */}
            <button
              className="up-btn-primary"
              disabled={!selectedQuote || loadingQuotes}
              onClick={handleBookRide}
            >
              Confirm {selectedQuote?.name || 'Ride'} &bull; ₹{selectedQuote?.totalFare || '0'}
            </button>
          </>
        )}
      </div>

      {/* RIGHT: Full-Screen Interactive Leaflet Map */}
      <div className="up-map-container">
        <div id="leaflet-map"></div>
      </div>

      {/* Safety & Emergency Modal */}
      {showSafetyModal && (
        <div className="up-modal-overlay">
          <div className="up-modal-card">
            <div className="up-modal-header">
              <h3 style={{ margin: 0, fontWeight: 700, color: '#b91c1c' }}>🛡️ Pune Passenger Safety & Emergency</h3>
              <button onClick={() => setShowSafetyModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div className="up-modal-body">
              <p style={{ fontSize: '0.9rem', color: 'var(--up-slate)', marginBottom: '1rem' }}>
                Your safety is our highest priority. The following emergency helplines are available 24x7 in Pune:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <a href="tel:112" style={{ padding: '0.75rem', background: '#fee2e2', borderRadius: '8px', textDecoration: 'none', color: '#991b1b', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                  <span>🚨 Pune Police Emergency</span>
                  <span>Dial 112</span>
                </a>
                <a href="tel:1091" style={{ padding: '0.75rem', background: '#fdf2f8', borderRadius: '8px', textDecoration: 'none', color: '#9d174d', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                  <span>👩 Women's Helpline</span>
                  <span>Dial 1091</span>
                </a>
                <a href="tel:108" style={{ padding: '0.75rem', background: '#f0fdf4', borderRadius: '8px', textDecoration: 'none', color: '#166534', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                  <span>🚑 Ambulance</span>
                  <span>Dial 108</span>
                </a>
              </div>
            </div>
            <div className="up-modal-footer">
              <button className="up-btn-primary" onClick={() => setShowSafetyModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && completedReceipt && (
        <div className="up-modal-overlay">
          <div className="up-modal-card">
            <div className="up-modal-header">
              <h3 style={{ margin: 0, fontWeight: 700, color: 'var(--up-navy)' }}>🧾 Official Trip Receipt</h3>
              <button onClick={() => setShowReceiptModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div className="up-modal-body">
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--up-navy)' }}>₹{completedReceipt.fare.total}</div>
                <div style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 600 }}>Payment Method: {completedReceipt.payment.method} &bull; COMPLETED</div>
              </div>
              <div className="up-receipt-row">
                <span>Trip Ref</span>
                <span>{completedReceipt.rideNumber}</span>
              </div>
              <div className="up-receipt-row">
                <span>Distance / Duration</span>
                <span>{completedReceipt.distanceKm} km &bull; {completedReceipt.durationMinutes} mins</span>
              </div>
              <div className="up-receipt-row">
                <span>Base Fare</span>
                <span>₹{completedReceipt.fare.breakdown.baseFare}</span>
              </div>
              <div className="up-receipt-row">
                <span>Distance Fare</span>
                <span>₹{completedReceipt.fare.breakdown.distanceFare}</span>
              </div>
              <div className="up-receipt-row">
                <span>Taxes & GST (5%)</span>
                <span>₹{completedReceipt.fare.breakdown.taxes}</span>
              </div>
              <div className="up-receipt-row">
                <span>Platform Fee</span>
                <span>₹{completedReceipt.fare.breakdown.platformFee}</span>
              </div>
              <div className="up-receipt-row total">
                <span>Total Paid</span>
                <span>₹{completedReceipt.fare.total}</span>
              </div>
            </div>
            <div className="up-modal-footer">
              <button className="up-btn-primary" onClick={() => { setShowReceiptModal(false); setShowRatingModal(true); }}>
                Rate Driver ⭐
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Driver Rating Modal */}
      {showRatingModal && (
        <div className="up-modal-overlay">
          <div className="up-modal-card">
            <div className="up-modal-header">
              <h3 style={{ margin: 0, fontWeight: 700, color: 'var(--up-navy)' }}>⭐ Rate Your Trip</h3>
            </div>
            <div className="up-modal-body" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--up-text-muted)' }}>How was your ride with {completedReceipt?.driver?.name || 'your driver'}?</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', margin: '1rem 0' }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setRatingScore(star)}
                    style={{ fontSize: '2rem', background: 'none', border: 'none', cursor: 'pointer', filter: star <= ratingScore ? 'none' : 'grayscale(100%)' }}
                  >
                    ⭐
                  </button>
                ))}
              </div>
              <textarea
                placeholder="Share optional feedback about driver driving, AC, cleanliness..."
                value={ratingFeedback}
                onChange={(e) => setRatingFeedback(e.target.value)}
                style={{ width: '100%', height: '80px', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--up-border)', outline: 'none' }}
              />
            </div>
            <div className="up-modal-footer">
              <button className="up-btn-primary" onClick={handleSubmitRating}>
                Submit Rating
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
