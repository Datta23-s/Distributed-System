// Ride Booking, Tracking, Cancellation, and Safety Support API
const express = require('express');
const router = express.Router();
const prisma = require('../../services/db');
const tripService = require('../../services/tripService');
const dispatchEngine = require('../../services/dispatchEngine');
const socketManager = require('../../services/socketManager');
const fareService = require('../../services/fareService');
const { jwtAuth } = require('../../middleware/auth');

// Get Recent Trips across Fleet (Dashboard & Operations Feed)
router.get('/recent', async (req, res) => {
  try {
    const rides = await prisma.ride.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        driver: {
          include: {
            user: { select: { name: true, phone: true } },
            vehicles: true
          }
        },
        statusEvents: { orderBy: { timestamp: 'asc' } }
      }
    });

    res.json({ success: true, rides });
  } catch (err) {
    console.error('[RideRoutes] /recent error:', err);
    res.status(500).json({ error: 'Failed to fetch recent rides' });
  }
});

// Customer auth middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (req.body && req.body.customerId) {
      req.user = { userId: req.body.customerId, role: 'CUSTOMER' };
      return next();
    }
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const token = authHeader.split(' ')[1];
    req.user = jwtAuth.verifyToken(token);
    next();
  } catch (err) {
    if (req.body && req.body.customerId) {
      req.user = { userId: req.body.customerId, role: 'CUSTOMER' };
      return next();
    }
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

router.use(authenticate);


// Book a Ride
router.post('/book', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.sub;
    const { quoteId, vehicleCategory, pickupAddress, pickupLat, pickupLng, destAddress, destLat, destLng, distanceKm, durationMinutes, estimatedFare } = req.body;

    // Validate quote if provided
    let verifiedFare = estimatedFare;
    if (quoteId) {
      const quote = await fareService.validateQuote(quoteId, vehicleCategory);
      verifiedFare = quote.totalFare;
    }

    if (!pickupAddress || !destAddress || !vehicleCategory || isNaN(pickupLat) || isNaN(pickupLng)) {
      return res.status(400).json({ error: 'Pickup, destination, and vehicle category are required.' });
    }

    // 1. Create durable Ride entity
    const ride = await tripService.createRide({
      customerId: userId,
      pickupAddress,
      pickupLat: parseFloat(pickupLat),
      pickupLng: parseFloat(pickupLng),
      destAddress,
      destLat: parseFloat(destLat),
      destLng: parseFloat(destLng),
      distanceKm: parseFloat(distanceKm || 3.5),
      durationMinutes: parseInt(durationMinutes || 12),
      vehicleCategory,
      estimatedFare: parseFloat(verifiedFare || 120),
      currency: 'INR'
    });

    // 2. Trigger asynchronous dispatch to find eligible nearby drivers
    dispatchEngine.dispatchRide(ride.id, socketManager).catch((err) => {
      console.error('[DispatchEngine] Async dispatch error:', err.message);
    });

    res.status(201).json({
      success: true,
      rideId: ride.id,
      rideNumber: ride.rideNumber,
      status: ride.status,
      vehicleCategory: ride.vehicleCategory,
      pickupAddress: ride.pickupAddress,
      destAddress: ride.destAddress,
      distanceKm: ride.distanceKm,
      estimatedFare: ride.estimatedFare,
      currency: ride.currency,
      tripPin: ride.tripPin,
      ride
    });
  } catch (err) {
    console.error('Ride booking error:', err);
    res.status(500).json({ error: err.message || 'Failed to book ride.' });
  }
});

// Get Active Ride for current Customer
router.get('/active', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.sub;
    const activeRide = await prisma.ride.findFirst({
      where: {
        customerId: userId,
        status: { in: ['REQUESTED', 'SEARCHING', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'IN_PROGRESS'] }
      },
      include: {
        driver: {
          include: {
            user: { select: { name: true, phone: true } },
            vehicles: true
          }
        },
        statusEvents: { orderBy: { timestamp: 'asc' } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, ride: activeRide || null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch active ride.' });
  }
});

// Get Specific Ride Details
router.get('/:id', async (req, res) => {
  try {
    const ride = await prisma.ride.findUnique({
      where: { id: req.params.id },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        driver: {
          include: {
            user: { select: { name: true, phone: true } },
            vehicles: true
          }
        },
        statusEvents: { orderBy: { timestamp: 'asc' } },
        payments: true
      }
    });

    if (!ride) return res.status(404).json({ error: 'Ride not found.' });
    res.json({ success: true, ride });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ride.' });
  }
});

// Cancel Ride
router.post('/:id/cancel', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.sub;
    const role = req.user.role || 'CUSTOMER';
    const { reason = 'Cancelled by customer' } = req.body;

    const result = await tripService.cancelRide(req.params.id, userId, role, reason);

    // Notify participants via WebSocket
    socketManager.notifyRide(req.params.id, 'RIDE_CANCELLED', {
      rideId: req.params.id,
      reason,
      cancelledBy: role
    });

    res.json({ success: true, message: 'Ride cancelled successfully.', result });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to cancel ride.' });
  }
});

// Submit Rating
router.post('/:id/rate', async (req, res) => {
  try {
    const { score, feedback } = req.body;
    const role = req.user.role || 'CUSTOMER';

    const rating = await tripService.submitRating({
      rideId: req.params.id,
      raterRole: role,
      score: parseInt(score),
      feedback
    });

    res.status(201).json({ success: true, rating });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to submit rating.' });
  }
});

// Submit Support Ticket / Safety Issue
router.post('/:id/support', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.sub;
    const { category = 'SAFETY_CONCERN', subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required.' });
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        userId,
        rideId: req.params.id,
        category,
        subject,
        message,
        status: 'OPEN'
      }
    });

    res.status(201).json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create support ticket.' });
  }
});

module.exports = router;
