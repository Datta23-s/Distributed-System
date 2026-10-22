// UrbanPulse Dispatch — Vehicle Information Card
// Matches Reference Layout: Vehicle image, category badge, license plate, mileage, rating, fuel/battery

function VehicleCard({ vehicle, driver, trip }) {
  const currentVehicle = vehicle || {
    make: 'Maruti Suzuki',
    model: 'Swift Dzire Tour',
    category: trip?.vehicleCategory || 'ECONOMY',
    licensePlate: 'MH 12 QX 4501',
    capacity: 4
  };

  const currentDriver = driver || {
    name: 'Rajesh Patil',
    rating: 4.89,
    totalTrips: 342
  };

  const category = (currentVehicle.category || trip?.vehicleCategory || 'ECONOMY').toUpperCase();
  const plate = currentVehicle.licensePlate || currentVehicle.plateNumber || 'MH 12 QX 4501';

  // Render Category-Specific SVG Illustration
  const renderVehicleSvg = () => {
    if (category === 'AUTO') {
      return (
        <svg className="ap-vehicle-svg" viewBox="0 0 320 130" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Rickshaw Shadow */}
          <ellipse cx="160" cy="116" rx="90" ry="8" fill="rgba(0,0,0,0.55)" />
          {/* Rickshaw Body */}
          <path d="M70 100 L70 55 C70 45 80 40 95 38 L210 38 C225 38 240 50 248 70 L260 85 C265 92 260 100 250 102 L80 102 Z" fill="#EAB308" stroke="#CA8A04" strokeWidth="2" />
          {/* Black Canvas Hood */}
          <path d="M70 55 C70 42 85 35 105 34 L210 34 C225 34 235 42 242 55 L70 55 Z" fill="#18181B" stroke="#27272A" strokeWidth="2" />
          {/* Open Cabin & Windshield */}
          <path d="M205 44 L235 68 L240 85 L205 85 Z" fill="#09090B" stroke="#3F3F46" strokeWidth="1.5" />
          {/* Passenger Cabin Opening */}
          <rect x="90" y="55" width="95" height="38" rx="6" fill="#18181B" stroke="#27272A" strokeWidth="1.5" />
          {/* Wheels */}
          <circle cx="95" cy="102" r="18" fill="#18181B" stroke="#52525B" strokeWidth="3" />
          <circle cx="95" cy="102" r="7" fill="#71717A" />
          <circle cx="235" cy="102" r="18" fill="#18181B" stroke="#52525B" strokeWidth="3" />
          <circle cx="235" cy="102" r="7" fill="#71717A" />
          {/* Green CNG Band */}
          <rect x="70" y="88" width="180" height="7" fill="#16A34A" />
        </svg>
      );
    }

    if (category === 'BIKE') {
      return (
        <svg className="ap-vehicle-svg" viewBox="0 0 320 130" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Bike Shadow */}
          <ellipse cx="160" cy="116" rx="80" ry="7" fill="rgba(0,0,0,0.55)" />
          {/* Wheels */}
          <circle cx="85" cy="98" r="24" fill="#18181B" stroke="#52525B" strokeWidth="3.5" />
          <circle cx="85" cy="98" r="10" fill="#27272A" stroke="#71717A" strokeWidth="2" />
          <circle cx="235" cy="98" r="24" fill="#18181B" stroke="#52525B" strokeWidth="3.5" />
          <circle cx="235" cy="98" r="10" fill="#27272A" stroke="#71717A" strokeWidth="2" />
          {/* Frame & Engine */}
          <path d="M85 98 L135 75 L180 75 L235 98" stroke="#3B82F6" strokeWidth="4" strokeLinecap="round" />
          <path d="M135 75 L160 55 L190 55 L210 75" stroke="#2563EB" strokeWidth="4" strokeLinecap="round" />
          <path d="M160 55 L180 40 L200 40" stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
          {/* Fuel Tank */}
          <ellipse cx="170" cy="52" rx="20" ry="9" fill="#1D4ED8" />
          {/* Headlamp */}
          <circle cx="205" cy="42" r="5" fill="#60A5FA" filter="drop-shadow(0 0 6px #3B82F6)" />
        </svg>
      );
    }

    // Default: Executive Sedan (Economy / Premium)
    const isPremium = category === 'PREMIUM';
    const bodyColor = isPremium ? '#1F1F23' : '#2A2A2E';
    const strokeColor = isPremium ? '#D4AF37' : '#45454B';
    const lampColor = isPremium ? '#FDE047' : '#60A5FA';

    return (
      <svg className="ap-vehicle-svg" viewBox="0 0 320 130" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Wheel Shadows */}
        <ellipse cx="78" cy="115" rx="36" ry="7" fill="rgba(0,0,0,0.5)" />
        <ellipse cx="242" cy="115" rx="36" ry="7" fill="rgba(0,0,0,0.5)" />
        {/* Car Body Silhouette */}
        <path d="M25 90 C25 80 35 68 50 65 L85 58 C105 45 130 26 175 25 L235 25 C255 25 275 42 288 60 L300 70 C310 76 312 84 310 94 L295 98 C290 98 285 92 280 92 C265 92 260 112 242 112 C225 112 220 92 205 92 L115 92 C100 92 95 112 78 112 C60 112 55 92 40 92 L25 90 Z" fill={bodyColor} stroke={strokeColor} strokeWidth="2" />
        {/* Windows / Cabin Glass */}
        <path d="M100 54 L165 33 L230 33 C245 33 260 45 268 56 L180 56 Z" fill="#141416" stroke="#3F3F46" strokeWidth="1.5" />
        {/* Cabin Divider */}
        <line x1="178" y1="33" x2="178" y2="56" stroke="#27272A" strokeWidth="2.5" />
        {/* Headlamp Beam Accent */}
        <polygon points="305,74 318,78 308,86" fill={lampColor} opacity="0.9" filter={`drop-shadow(0 0 6px ${lampColor})`} />
        {/* Taillamp Accent */}
        <polygon points="28,78 22,82 25,88" fill="#EF4444" opacity="0.9" filter="drop-shadow(0 0 4px #DC2626)" />
        {/* Front Wheel */}
        <circle cx="78" cy="98" r="22" fill="#18181B" stroke="#52525B" strokeWidth="3" />
        <circle cx="78" cy="98" r="12" fill="#27272A" stroke="#71717A" strokeWidth="2" />
        <circle cx="78" cy="98" r="4" fill="#E4E4E7" />
        {/* Rear Wheel */}
        <circle cx="242" cy="98" r="22" fill="#18181B" stroke="#52525B" strokeWidth="3" />
        <circle cx="242" cy="98" r="12" fill="#27272A" stroke="#71717A" strokeWidth="2" />
        <circle cx="242" cy="98" r="4" fill="#E4E4E7" />
        {/* Aerodynamic Door Line */}
        <path d="M110 74 L210 74" stroke="#3A3A40" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  };

  return (
    <div className="ap-card ap-vehicle-card">
      {/* Sleek Automotive Visual */}
      <div className="ap-vehicle-image-wrap">
        {renderVehicleSvg()}
      </div>

      {/* Vehicle Info & Metrics */}
      <div className="ap-vehicle-details">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="ap-vehicle-name">
              {currentVehicle.make} {currentVehicle.model}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
              <span className="ap-vehicle-category-badge">
                {category === 'PREMIUM' ? '✨ Premier Sedan' : category === 'AUTO' ? '🛺 Auto Rickshaw' : category === 'BIKE' ? '🏍️ Moto' : '🚗 Economy AC'}
              </span>
              <span className="ap-plate-pill">{plate}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.82rem', color: '#FBBF24', fontWeight: 700 }}>
            ⭐ {currentDriver.rating} <span style={{ color: 'var(--ap-text-muted)', fontSize: '0.72rem', fontWeight: 500 }}>({currentDriver.totalTrips || 342} trips)</span>
          </div>
        </div>

        {/* Technical & Operational Metrics Strip */}
        <div className="ap-vehicle-stats-row">
          <div>
            <div className="ap-stat-item-label">Distance / Trip</div>
            <div className="ap-stat-item-val">{trip?.distanceKm ? `${trip.distanceKm} km` : '14.5 km'}</div>
          </div>
          <div>
            <div className="ap-stat-item-label">Capacity</div>
            <div className="ap-stat-item-val">{currentVehicle.capacity || (category === 'BIKE' ? 1 : category === 'AUTO' ? 3 : 4)} Passengers</div>
          </div>
          <div>
            <div className="ap-stat-item-label">Range / Status</div>
            <div className="ap-stat-item-val" style={{ color: '#36C85B' }}>88% Optimal</div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.VehicleCard = VehicleCard;
