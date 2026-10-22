// UrbanPulse Dispatch — Vertical Trip Route Timeline
// Matches Reference Layout: Pickup with green dot, Intermediate waypoint, Destination with blue square, timestamps

function TripTimeline({ trip }) {
  const pickupAddr = trip?.pickupAddress || 'FC Road, Shivajinagar, Pune 411005';
  const destAddr = trip?.destAddress || 'Hinjewadi IT Park Phase 1, Pune 411057';
  const status = trip?.status || 'IN_PROGRESS';

  return (
    <div className="ap-timeline-card">
      <div className="ap-timeline-title">TRIP ROUTE TIMELINE</div>

      <div className="ap-timeline-track">
        {/* Step 1: Pickup */}
        <div className="ap-timeline-step">
          <div className="ap-step-dot pickup">
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#36C85B' }}></div>
          </div>
          <div className="ap-step-content">
            <div className="ap-step-label">Pickup Location</div>
            <div className="ap-step-address">{pickupAddr}</div>
            <div className="ap-step-time">10:15 AM &bull; Verified</div>
          </div>
        </div>

        {/* Step 2: Waypoint / Driver Status */}
        <div className="ap-timeline-step">
          <div className="ap-step-dot current">
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#E6CF00' }}></div>
          </div>
          <div className="ap-step-content">
            <div className="ap-step-label">Journey Status</div>
            <div className="ap-step-address">
              {status === 'COMPLETED' ? 'Trip Completed & Fare Settled' : status === 'IN_PROGRESS' ? 'In Transit &bull; Pune-Bangalore Hwy' : 'Driver En Route to Pickup'}
            </div>
            <div className="ap-step-time">10:28 AM &bull; Live Telemetry</div>
          </div>
        </div>

        {/* Step 3: Destination */}
        <div className="ap-timeline-step">
          <div className="ap-step-dot dest">
            <div style={{ width: '6px', height: '6px', borderRadius: '2px', background: '#1677FF' }}></div>
          </div>
          <div className="ap-step-content">
            <div className="ap-step-label">Destination</div>
            <div className="ap-step-address">{destAddr}</div>
            <div className="ap-step-time">Est. 10:48 AM &bull; Dropoff Gate 2</div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.TripTimeline = TripTimeline;

