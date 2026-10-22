// UrbanPulse Dispatch — Vehicle Information Card
// Matches Reference Layout: Vehicle image, category badge, license plate, mileage, rating, fuel/battery

function VehicleCard({ vehicle, driver, trip }) {
  const currentVehicle = vehicle || {
    make: 'Maruti Suzuki',
    model: 'Swift Dzire Tour',
    category: 'ECONOMY',
    licensePlate: 'MH 12 QX 4501',
    capacity: 4
  };

  const currentDriver = driver || {
    name: 'Rajesh Patil',
    rating: 4.89,
    totalTrips: 342
  };

  return (
    <div className="ap-card ap-vehicle-card">
      {/* Sleek Automotive Visual */}
      <div className="ap-vehicle-image-wrap">
        <svg className="ap-vehicle-svg" viewBox="0 0 320 130" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Wheel Shadows */}
          <ellipse cx="78" cy="115" rx="36" ry="7" fill="rgba(0,0,0,0.5)" />
          <ellipse cx="242" cy="115" rx="36" ry="7" fill="rgba(0,0,0,0.5)" />
          {/* Car Body Silhouette */}
          <path d="M25 90 C25 80 35 68 50 65 L85 58 C105 45 130 26 175 25 L235 25 C255 25 275 42 288 60 L300 70 C310 76 312 84 310 94 L295 98 C290 98 285 92 280 92 C265 92 260 112 242 112 C225 112 220 92 205 92 L115 92 C100 92 95 112 78 112 C60 112 55 92 40 92 L25 90 Z" fill="#2A2A2E" stroke="#45454B" strokeWidth="2" />
          {/* Windows / Cabin Glass */}
          <path d="M100 54 L165 33 L230 33 C245 33 260 45 268 56 L180 56 Z" fill="#141416" stroke="#3F3F46" strokeWidth="1.5" />
          {/* Cabin Divider */}
          <line x1="178" y1="33" x2="178" y2="56" stroke="#27272A" strokeWidth="2.5" />
          {/* Headlamp Beam Accent */}
          <polygon points="305,74 318,78 308,86" fill="#60A5FA" opacity="0.9" filter="drop-shadow(0 0 6px #3B82F6)" />
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
                {currentVehicle.category === 'PREMIUM' ? '✨ Premier Sedan' : currentVehicle.category === 'AUTO' ? '🛺 Auto Rickshaw' : currentVehicle.category === 'BIKE' ? '🏍️ Moto' : '🚗 Economy AC'}
              </span>
              <span className="ap-plate-pill">{currentVehicle.licensePlate}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.82rem', color: '#FBBF24', fontWeight: 700 }}>
            ⭐ {currentDriver.rating} <span style={{ color: 'var(--ap-text-muted)', fontSize: '0.72rem', fontWeight: 500 }}>({currentDriver.totalTrips} trips)</span>
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
            <div className="ap-stat-item-val">{currentVehicle.capacity || 4} Passengers</div>
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

