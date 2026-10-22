// UrbanPulse Dispatch — Right-Side Trips History Panel
// Matches Reference Layout: Header with Search, Vertically Stacked Trip Cards, Status Badges, Selection state

function TripsPanel({ trips = [], selectedTripId, onSelectTrip, onOpenBooking, onViewHistory }) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterTab, setFilterTab] = React.useState('all'); // 'all' | 'active' | 'completed'

  // Default illustrative trips if backend list is initializing
  const defaultTrips = [
    {
      id: 'demo-1',
      rideNumber: 'UP-PUN-72819',
      customer: { name: 'Aarav Sharma' },
      vehicleCategory: 'ECONOMY',
      status: 'IN_PROGRESS',
      finalFare: 295,
      estimatedFare: 295,
      createdAt: new Date().toISOString(),
      pickupAddress: 'FC Road, Shivajinagar, Pune',
      destAddress: 'Hinjewadi IT Park Phase 1, Pune',
      pickupLat: 18.5314,
      pickupLng: 73.8446,
      destLat: 18.5912,
      destLng: 73.7389,
      distanceKm: 14.5,
      durationMinutes: 24,
      tripPin: '8492'
    },
    {
      id: 'demo-2',
      rideNumber: 'UP-PUN-51042',
      customer: { name: 'Priya Kulkarni' },
      vehicleCategory: 'PREMIUM',
      status: 'COMPLETED',
      finalFare: 480,
      estimatedFare: 480,
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      pickupAddress: 'Koregaon Park (Lane 7), Pune',
      destAddress: 'Pune Airport (PNQ), Lohegaon',
      pickupLat: 18.5362,
      pickupLng: 73.8940,
      destLat: 18.5822,
      destLng: 73.9197,
      distanceKm: 7.8,
      durationMinutes: 18,
      tripPin: '3190'
    },
    {
      id: 'demo-3',
      rideNumber: 'UP-PUN-33910',
      customer: { name: 'Rohit Deshmukh' },
      vehicleCategory: 'AUTO',
      status: 'COMPLETED',
      finalFare: 140,
      estimatedFare: 140,
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      pickupAddress: 'Swargate Bus Depot, Pune',
      destAddress: 'Deccan Gymkhana, Pune',
      pickupLat: 18.5018,
      pickupLng: 73.8580,
      destLat: 18.5170,
      destLng: 73.8415,
      distanceKm: 4.2,
      durationMinutes: 14,
      tripPin: '6621'
    },
    {
      id: 'demo-4',
      rideNumber: 'UP-PUN-18239',
      customer: { name: 'Sneha Patil' },
      vehicleCategory: 'BIKE',
      status: 'COMPLETED',
      finalFare: 75,
      estimatedFare: 75,
      createdAt: new Date(Date.now() - 3600000 * 9).toISOString(),
      pickupAddress: 'Kothrud (Chandani Chowk), Pune',
      destAddress: 'FC Road, Shivajinagar, Pune',
      pickupLat: 18.5089,
      pickupLng: 73.8055,
      destLat: 18.5314,
      destLng: 73.8446,
      distanceKm: 6.1,
      durationMinutes: 15,
      tripPin: '4108'
    }
  ];

  const sourceList = trips.length > 0 ? trips : defaultTrips;

  const filteredTrips = sourceList.filter(t => {
    const q = searchQuery.toLowerCase();
    const matchQuery =
      (t.rideNumber && t.rideNumber.toLowerCase().includes(q)) ||
      (t.customer?.name && t.customer.name.toLowerCase().includes(q)) ||
      (t.pickupAddress && t.pickupAddress.toLowerCase().includes(q)) ||
      (t.destAddress && t.destAddress.toLowerCase().includes(q)) ||
      (t.vehicleCategory && t.vehicleCategory.toLowerCase().includes(q));

    if (!matchQuery) return false;
    if (filterTab === 'active') return t.status !== 'COMPLETED' && t.status !== 'CANCELLED';
    if (filterTab === 'completed') return t.status === 'COMPLETED';
    return true;
  });

  return (
    <aside className="ap-trips-panel">
      {/* Header */}
      <div className="ap-trips-panel-header">
        <div className="ap-trips-title">Trips</div>
        <span style={{ fontSize: '0.75rem', color: 'var(--ap-text-muted)', fontWeight: 600 }}>
          {filteredTrips.length} Records
        </span>
      </div>

      {/* Search Input */}
      <div className="ap-trips-search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="text"
          placeholder="Search ride ID, name, area..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{ background: 'transparent', border: 'none', color: 'var(--ap-text-muted)', cursor: 'pointer', padding: 0, fontSize: '0.75rem' }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Filter Chips */}
      <div style={{ display: 'flex', gap: '0.35rem' }}>
        {['all', 'active', 'completed'].map(tab => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            style={{
              flex: 1,
              padding: '0.35rem 0.5rem',
              borderRadius: '6px',
              border: 'none',
              background: filterTab === tab ? '#27272A' : 'transparent',
              color: filterTab === tab ? '#ffffff' : 'var(--ap-text-muted)',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              textTransform: 'capitalize'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Scrollable List of Trips */}
      <div className="ap-trips-list">
        {filteredTrips.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--ap-text-muted)', fontSize: '0.8rem' }}>
            <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>🔍</div>
            No trips matching filter
          </div>
        ) : (
          filteredTrips.map(tripItem => {
            const isSelected = (selectedTripId === tripItem.id) || (!selectedTripId && tripItem.id === sourceList[0]?.id);
            const isCompleted = tripItem.status === 'COMPLETED';
            const isCancelled = tripItem.status === 'CANCELLED';
            const badgeClass = isCompleted ? 'completed' : isCancelled ? 'cancelled' : 'active';
            const badgeText = isCompleted ? 'Completed' : isCancelled ? 'Cancelled' : 'Active';

            return (
              <div
                key={tripItem.id}
                className={`ap-trip-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectTrip(tripItem)}
              >
                <div className="ap-trip-card-top">
                  <div className="ap-trip-card-user">
                    <div className="ap-trip-avatar-sm">
                      {tripItem.customer?.name ? tripItem.customer.name.charAt(0) : 'U'}
                    </div>
                    <div>
                      <div className="ap-trip-user-name">
                        {tripItem.customer?.name || 'Customer'}
                      </div>
                      <div className="ap-trip-card-time">
                        {tripItem.rideNumber}
                      </div>
                    </div>
                  </div>
                  <span className={`ap-badge ${badgeClass}`} style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem' }}>
                    {badgeText}
                  </span>
                </div>

                <div className="ap-trip-card-bottom">
                  <div style={{ fontSize: '0.72rem', color: 'var(--ap-text-muted)' }}>
                    {tripItem.vehicleCategory || 'ECONOMY'}
                  </div>
                  <div className="ap-trip-card-price">
                    ₹{tripItem.finalFare || tripItem.estimatedFare || 295}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: 'auto' }}>
        <button
          className="ap-btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={onOpenBooking}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Book New Ride
        </button>

        <button
          className="ap-btn-secondary"
          style={{ width: '100%', justifyContent: 'center', fontSize: '0.78rem' }}
          onClick={() => onViewHistory && onViewHistory()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          View Full History
        </button>
      </div>
    </aside>
  );
}

window.TripsPanel = TripsPanel;


