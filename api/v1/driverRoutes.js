// Driver Portal API: Availability, Offers, Navigation, PIN Verification, Earnings
const express = require('express');
const router = express.Router();
const prisma = require('../../services/db');
const dispatchEngine = require('../../services/dispatchEngine');
const tripService = require('../../services/tripService');
const socketManager = require('../../services/socketManager');
const { jwtAuth } = require('../../middleware/auth');

// Driver authentication middleware
const authenticateDriver = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Driver authentication required' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwtAuth.verifyToken(token);
    const userId = decoded.userId || decoded.sub;

    const driver = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        vehicles: true
      }
    });

    if (!driver) {
      return res.status(403).json({ error: 'User is not registered as a driver.' });
    }

    req.driver = driver;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired driver token.' });
  }
};

router.use(authenticateDriver);

// Get Driver Profile & Current Status
router.get('/profile', async (req, res) => {
  res.json({ success: true, driver: req.driver });
});

// Toggle Status (AVAILABLE <-> OFFLINE)
router.post('/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['AVAILABLE', 'OFFLINE'].includes(status)) {
      return res.status(400).json({ error: 'Status must be AVAILABLE or OFFLINE.' });
    }

    // Do not allow going offline if currently on a trip
    if (req.driver.status === 'ON_TRIP' || req.driver.status === 'RESERVED') {
      return res.status(400).json({ error: 'Cannot change status while engaged in an active trip.' });
    }

    const updated = await prisma.driverProfile.update({
      where: { id: req.driver.id },
      data: { status }
    });

    // Notify admin
    socketManager.broadcastToRoom('admin', 'DRIVER_STATUS_CHANGE', {
      driverId: req.driver.id,
      name: req.driver.user.name,
      status: updated.status
    });

    res.json({ success: true, status: updated.status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status.' });
  }
});

// Update Location Coordinates
router.post('/location', async (req, res) => {
  try {
    const { latitude, longitude, heading = 0, speed = 0, rideId } = req.body;

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: 'Valid latitude and longitude required.' });
    }

    const updated = await prisma.driverProfile.update({
      where: { id: req.driver.id },
      data: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        lastLocationUpdate: new Date()
      }
    });

    // Broadcast through socket
    if (rideId) {
      socketManager.notifyRide(rideId, 'DRIVER_LOCATION_UPDATE', {
        driverId: req.driver.id,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        heading,
        speed
      });
    }

    socketManager.broadcastToRoom('admin', 'FLEET_DRIVER_UPDATE', {
      driverId: req.driver.id,
      name: req.driver.user.name,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude)
    });

    res.json({ success: true, latitude: updated.latitude, longitude: updated.longitude });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update location.' });
  }
});

// Get Pending Offers
router.get('/offers', async (req, res) => {
  try {
    const pendingOffer = await prisma.rideAssignment.findFirst({
      where: {
        driverId: req.driver.id,
        status: 'OFFERED'
      },
      include: {
        ride: {
          include: { customer: { select: { name: true, phone: true } } }
        }
      },
      orderBy: { offeredAt: 'desc' }
    });

    res.json({ success: true, offer: pendingOffer || null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch driver offers.' });
  }
});

// Accept Ride Offer
router.post('/assignments/:id/accept', async (req, res) => {
  try {
    const ride = await dispatchEngine.acceptOffer(req.driver.id, req.params.id, socketManager);
    res.json({ success: true, message: 'Ride accepted!', ride });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to accept ride.' });
  }
});

// Reject Ride Offer
router.post('/assignments/:id/reject', async (req, res) => {
  try {
    await dispatchEngine.rejectOffer(req.driver.id, req.params.id, socketManager);
    res.json({ success: true, message: 'Offer rejected.' });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to reject offer.' });
  }
});

// Mark En Route to Pickup
router.post('/rides/:id/arriving', async (req, res) => {
  try {
    const ride = await tripService.markDriverArriving(req.params.id, req.driver.id);
    socketManager.notifyRide(req.params.id, 'RIDE_STATUS_UPDATED', {
      rideId: req.params.id,
      status: 'DRIVER_ARRIVING',
      message: 'Driver is on the way to pick you up.'
    });
    res.json({ success: true, ride });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to mark arriving.' });
  }
});

// Mark Arrived at Pickup
router.post('/rides/:id/arrived', async (req, res) => {
  try {
    const ride = await tripService.markDriverArrived(req.params.id, req.driver.id);
    socketManager.notifyRide(req.params.id, 'RIDE_STATUS_UPDATED', {
      rideId: req.params.id,
      status: 'DRIVER_ARRIVED',
      message: 'Driver has arrived at the pickup location!'
    });
    res.json({ success: true, ride });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to mark arrived.' });
  }
});

// Verify Trip PIN & Start Journey
router.post('/rides/:id/verify-pin', async (req, res) => {
  try {
    const { tripPin } = req.body;
    if (!tripPin) {
      return res.status(400).json({ error: '4-digit trip PIN is required.' });
    }

    const ride = await tripService.startTrip(req.params.id, req.driver.id, tripPin);
    socketManager.notifyRide(req.params.id, 'TRIP_STARTED', {
      rideId: req.params.id,
      status: 'IN_PROGRESS',
      startTime: ride.startTime
    });

    res.json({ success: true, message: 'Trip PIN verified. Journey started!', ride });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Complete Trip
router.post('/rides/:id/complete', async (req, res) => {
  try {
    const ride = await tripService.completeTrip(req.params.id, req.driver.id);
    socketManager.notifyRide(req.params.id, 'TRIP_COMPLETED', {
      rideId: req.params.id,
      status: 'COMPLETED',
      finalFare: ride.finalFare,
      endTime: ride.endTime
    });

    res.json({ success: true, message: 'Trip completed successfully!', ride });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to complete trip.' });
  }
});

// Driver Earnings & Past Trips
router.get('/earnings', async (req, res) => {
  try {
    const trips = await prisma.ride.findMany({
      where: {
        driverId: req.driver.id,
        status: 'COMPLETED'
      },
      orderBy: { endTime: 'desc' },
      take: 25
    });

    res.json({
      success: true,
      summary: {
        totalTrips: req.driver.totalTrips,
        totalEarnings: req.driver.totalEarnings,
        currency: 'INR',
        rating: req.driver.rating
      },
      trips
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch earnings.' });
  }
});

module.exports = router;
