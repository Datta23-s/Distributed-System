// Customer Profile, Saved Places, and Trip History API
const express = require('express');
const router = express.Router();
const prisma = require('../../services/db');
const tripService = require('../../services/tripService');
const { jwtAuth } = require('../../middleware/auth');

// Auth middleware for customer
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const token = authHeader.split(' ')[1];
    req.user = jwtAuth.verifyToken(token);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

router.use(authenticate);

// Get Profile
router.get('/profile', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.sub;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { customerProfile: true, savedPlaces: true }
    });
    res.json({ success: true, profile: user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customer profile' });
  }
});

// Update Emergency Contact
router.put('/profile/emergency', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.sub;
    const { contactName, contactPhone } = req.body;

    const profile = await prisma.customerProfile.upsert({
      where: { userId },
      update: {
        emergencyContactName: contactName,
        emergencyContactPhone: contactPhone
      },
      create: {
        userId,
        emergencyContactName: contactName,
        emergencyContactPhone: contactPhone
      }
    });

    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update emergency contact' });
  }
});

// Saved Places
router.get('/saved-places', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.sub;
    const places = await prisma.savedPlace.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, places });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch saved places' });
  }
});

router.post('/saved-places', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.sub;
    const { label, address, latitude, longitude } = req.body;

    if (!label || !address || isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: 'Label, address, latitude, and longitude are required' });
    }

    const place = await prisma.savedPlace.create({
      data: {
        userId,
        label,
        address,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude)
      }
    });

    res.status(201).json({ success: true, place });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create saved place' });
  }
});

router.delete('/saved-places/:id', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.sub;
    await prisma.savedPlace.deleteMany({
      where: { id: req.params.id, userId }
    });
    res.json({ success: true, message: 'Saved place removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete saved place' });
  }
});

// Ride History
router.get('/rides', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.sub;
    const rides = await prisma.ride.findMany({
      where: { customerId: userId },
      include: {
        driver: {
          include: {
            user: { select: { name: true, phone: true } },
            vehicles: true
          }
        },
        ratings: true,
        payments: true
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json({ success: true, count: rides.length, rides });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ride history' });
  }
});

// Individual Ride Receipt
router.get('/receipt/:rideId', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.sub;
    const receipt = await tripService.getReceipt(req.params.rideId, userId);
    res.json({ success: true, receipt });
  } catch (err) {
    res.status(404).json({ error: err.message || 'Receipt not found' });
  }
});

module.exports = router;
