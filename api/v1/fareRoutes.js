// Fare Engine & Quote Generation API
const express = require('express');
const router = express.Router();
const geoService = require('../../services/geoService');
const fareService = require('../../services/fareService');
const prisma = require('../../services/db');

// Request Fare Quotes for all vehicle tiers
router.post('/quote', async (req, res) => {
  try {
    const { pickupAddress, pickupLat, pickupLng, destAddress, destLat, destLng, customerId } = req.body;
    const pAddress = pickupAddress || 'FC Road, Shivajinagar, Pune';
    const dAddress = destAddress || 'Hinjewadi IT Park Phase 1, Pune';

    if (isNaN(pickupLat) || isNaN(pickupLng) || isNaN(destLat) || isNaN(destLng)) {
      return res.status(400).json({ error: 'Valid pickup and destination coordinates are required.' });
    }

    // Calculate real road distance and travel duration in Pune traffic
    const route = geoService.calculateRoute(pickupLat, pickupLng, destLat, destLng);

    // Generate quotes across vehicle categories
    const quotes = await fareService.generateQuotes({
      customerId: customerId || null,
      pickupAddress: pAddress,
      pickupLat,
      pickupLng,
      destAddress: dAddress,
      destLat,
      destLng,
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes
    });


    res.json({
      success: true,
      route: {
        distanceKm: route.distanceKm,
        durationMinutes: route.durationMinutes,
        routeGeometry: route.routeGeometry
      },
      currency: 'INR',
      quotes
    });
  } catch (err) {
    console.error('Fare quote error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate fare quotes.' });
  }
});

// Get Active Pricing Rules
router.get('/categories', async (req, res) => {
  try {
    const configs = await prisma.fareConfiguration.findMany({
      where: { isActive: true }
    });
    res.json({ success: true, categories: configs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load vehicle categories.' });
  }
});

module.exports = router;
