// UrbanPulse Dispatch — Trip Information Card
// Matches Reference Layout: "TRIP INFORMATION", Ride ID, Fare (₹), Status Badge, Driver/Customer Snippet, 4-Digit PIN

function TripInfoCard({ trip, onTrackRide, onOpenBooking }) {
  const currentTrip = trip || {
    rideNumber: 'UP-PUN-72819',
    estimatedFare: 295,
    finalFare: 295,
    status: 'IN_PROGRESS',
    tripPin: '8492',
    customer: { name: 'Aarav Sharma' },
    driver: {
      user: { name: 'Rajesh Patil', phone: '+91 91234 56789' },
      rating: 4.89
    }
  };

  const isCompleted = currentTrip.status === 'COMPLETED';
  const isActive = currentTrip.status === 'IN_PROGRESS' || currentTrip.status === 'DRIVER_ASSIGNED' || currentTrip.status === 'DRIVER_ARRIVED' || currentTrip.status === 'SEARCHING';
  const isCancelled = currentTrip.status === 'CANCELLED';

  const badgeClass = isCompleted ? 'completed' : isCancelled ? 'cancelled' : 'active';
  const badgeLabel = currentTrip.status ? currentTrip.status.replace('_', ' ') : 'ACTIVE';

  return (
    <div className="ap-card ap-trip-info-card">
      {/* Header: Title, Ride Number, Amount */}
      <div className="ap-trip-info-header">
        <div>
          <div className="ap-trip-info-title">TRIP INFORMATION</div>
          <div className="ap-trip-id">{currentTrip.rideNumber}</div>
        </div>
        <div>
          <div className="ap-trip-amount">
            ₹{currentTrip.finalFare || currentTrip.estimatedFare || '295'}
          </div>
          <div style={{ textAlign: 'right', marginTop: '0.2rem' }}>
            <span className={`ap-badge ${badgeClass}`}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor', display: 'inline-block' }}></span>
              {badgeLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Driver & Passenger Snippet */}
      <div className="ap-trip-driver-row">
        <div className="ap-driver-snippet">
          <div className="ap-driver-avatar">
            {currentTrip.driver?.user?.name ? currentTrip.driver.user.name.charAt(0) : 'R'}
          </div>
          <div>
            <div className="ap-driver-name">
              {currentTrip.driver?.user?.name || 'Assigned Driver'}
            </div>
            <div className="ap-driver-rating">
              ⭐ {currentTrip.driver?.rating || '4.89'} &bull; Passenger: {currentTrip.customer?.name || 'Aarav Sharma'}
            </div>
          </div>
        </div>

        {/* 4-Digit Trip Verification PIN */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--ap-text-muted)', textTransform: 'uppercase', marginBottom: '0.15rem' }}>
            Trip PIN
          </div>
          <div className="ap-pin-badge">
            {currentTrip.tripPin || '7394'}
          </div>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
        <button
          className="ap-btn-primary"
          style={{ flex: 1, justifyContent: 'center' }}
          onClick={onTrackRide}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
          Track Ride
        </button>
        <button
          className="ap-btn-secondary"
          onClick={onOpenBooking}
          title="Book a new trip"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
          New Booking
        </button>
      </div>
    </div>
  );
}

window.TripInfoCard = TripInfoCard;

