// Map & Routing Provider API
const express = require('express');
const router = express.Router();
const geoService = require('../../services/geoService');

// Address Search / Suggestions
router.get('/search', (req, res) => {
  const query = req.query.q || '';
  const suggestions = geoService.searchLocations(query);
  res.json({
    success: true,
    query,
    count: suggestions.length,
    results: suggestions
  });
});

// Reverse Geocoding
router.get('/reverse', (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'Valid lat and lng query parameters are required.' });
  }

  const result = geoService.reverseGeocode(lat, lng);
  res.json({ success: true, result });
});

// Route Calculation
router.post('/route', (req, res) => {
  const { startLat, startLng, endLat, endLng } = req.body;

  if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
    return res.status(400).json({ error: 'startLat, startLng, endLat, and endLng are required.' });
  }

  const route = geoService.calculateRoute(startLat, startLng, endLat, endLng);
  res.json({ success: true, route });
});

module.exports = router;
