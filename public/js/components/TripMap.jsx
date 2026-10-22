// UrbanPulse Dispatch — Interactive Trip Map Component
// Matches Reference Layout: Dark high-contrast Leaflet map, neon route polyline, live driver marker, compact metrics strip

function TripMap({ trip, routeGeometry, driverLocation }) {
  const mapRef = React.useRef(null);
  const markersRef = React.useRef({ pickup: null, dest: null, route: null, driver: null });

  const defaultPickup = { lat: 18.5314, lng: 73.8446, name: 'FC Road, Shivajinagar, Pune' };
  const defaultDest = { lat: 18.5912, lng: 73.7389, name: 'Hinjewadi IT Park Phase 1, Pune' };

  const pickup = (trip && trip.pickupLat && trip.pickupLng) ? {
    lat: trip.pickupLat,
    lng: trip.pickupLng,
    name: trip.pickupAddress || defaultPickup.name
  } : defaultPickup;

  const destination = (trip && trip.destLat && trip.destLng) ? {
    lat: trip.destLat,
    lng: trip.destLng,
    name: trip.destAddress || defaultDest.name
  } : defaultDest;

  // Initialize Leaflet Map with CartoDB Dark Matter tiles
  React.useEffect(() => {
    if (mapRef.current) return;
    const container = document.getElementById('automotive-leaflet-map');
    if (!container || !window.L) return;

    const map = window.L.map('automotive-leaflet-map', {
      zoomControl: true,
      attributionControl: false
    }).setView([18.5500, 73.8000], 12);

    // CartoDB Dark Matter dark map tiles
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    mapRef.current = map;
  }, []);

  // Update Markers & Route
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.L) return;

    // Custom Glowing Pickup Marker (Green)
    if (markersRef.current.pickup) markersRef.current.pickup.remove();
    markersRef.current.pickup = window.L.marker([pickup.lat, pickup.lng], {
      icon: window.L.divIcon({
        className: 'ap-marker-pickup',
        html: '<div style="width:14px;height:14px;background:#36C85B;border-radius:50%;box-shadow:0 0 0 4px rgba(54,200,91,0.25),0 0 12px #36C85B;"></div>'
      })
    }).addTo(map).bindPopup(`<b style="color:#101010">Pickup:</b> ${pickup.name}`);

    // Custom Glowing Destination Marker (Blue)
    if (markersRef.current.dest) markersRef.current.dest.remove();
    markersRef.current.dest = window.L.marker([destination.lat, destination.lng], {
      icon: window.L.divIcon({
        className: 'ap-marker-dest',
        html: '<div style="width:14px;height:14px;background:#1677FF;border-radius:3px;box-shadow:0 0 0 4px rgba(22,119,255,0.25),0 0 12px #1677FF;"></div>'
      })
    }).addTo(map).bindPopup(`<b style="color:#101010">Destination:</b> ${destination.name}`);

    // Draw Route Polyline
    const coordinates = (routeGeometry && routeGeometry.length > 0) ? routeGeometry : [
      [pickup.lat, pickup.lng],
      [18.5450, 73.8200],
      [18.5600, 73.7800],
      [18.5750, 73.7550],
      [destination.lat, destination.lng]
    ];

    if (markersRef.current.route) markersRef.current.route.remove();
    markersRef.current.route = window.L.polyline(coordinates, {
      color: '#1677FF',
      weight: 5,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    map.fitBounds(markersRef.current.route.getBounds(), { padding: [35, 35] });

    // Live Driver Marker
    const driverLat = driverLocation?.latitude || (pickup.lat + (destination.lat - pickup.lat) * 0.45);
    const driverLng = driverLocation?.longitude || (pickup.lng + (destination.lng - pickup.lng) * 0.45);

    if (markersRef.current.driver) markersRef.current.driver.remove();
    markersRef.current.driver = window.L.marker([driverLat, driverLng], {
      icon: window.L.divIcon({
        className: 'ap-marker-driver',
        html: '<div style="background:#1B1B1D;border:2px solid #1677FF;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(22,119,255,0.5);font-size:16px;">🚗</div>'
      })
    }).addTo(map).bindPopup('<b style="color:#101010">Rajesh Patil (Swift Dzire)</b><br/>Speed: 28 km/h');
  }, [pickup.lat, pickup.lng, destination.lat, destination.lng, routeGeometry, driverLocation]);

  return (
    <div className="ap-map-card">
      {/* Top Strip with Trip Metrics */}
      <div className="ap-map-metrics-strip">
        <span className="ap-metric-tag">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1677FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          Duration: <strong>{trip?.durationMinutes || 24} mins</strong>
        </span>
        <span className="ap-metric-tag">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#36C85B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
          Distance: <strong>{trip?.distanceKm || 14.5} km</strong>
        </span>
        <span className="ap-metric-tag">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E6CF00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          Speed: <strong>28 km/h</strong>
        </span>
        <span className="ap-metric-tag">
          Category: <strong>{trip?.vehicleCategory || 'ECONOMY'}</strong>
        </span>
      </div>

      {/* Map Canvas */}
      <div className="ap-map-container">
        <div id="automotive-leaflet-map"></div>
      </div>
    </div>
  );
}

window.TripMap = TripMap;

