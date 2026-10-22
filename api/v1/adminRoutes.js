// Admin & Dispatch Operations Dashboard API
const express = require('express');
const router = express.Router();
const prisma = require('../../services/db');
const { jwtAuth } = require('../../middleware/auth');
const circuitBreakers = require('../../middleware/circuitBreaker');

// Admin role verification middleware
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Admin authentication required.' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwtAuth.verifyToken(token);
    if (decoded.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied: Administrator role required.' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired admin session.' });
  }
};

router.use(authenticateAdmin);

// Operational Metrics Overview
router.get('/overview', async (req, res) => {
  try {
    const [
      totalRequested,
      activeRides,
      completedRides,
      cancelledRides,
      totalDrivers,
      availableDrivers,
      payments
    ] = await Promise.all([
      prisma.ride.count({ where: { status: 'REQUESTED' } }),
      prisma.ride.count({ where: { status: { in: ['SEARCHING', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'IN_PROGRESS'] } } }),
      prisma.ride.count({ where: { status: 'COMPLETED' } }),
      prisma.ride.count({ where: { status: 'CANCELLED' } }),
      prisma.driverProfile.count(),
      prisma.driverProfile.count({ where: { status: 'AVAILABLE' } }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'COMPLETED' }
      })
    ]);

    const totalRevenue = payments._sum.amount || 0;

    res.json({
      success: true,
      metrics: {
        totalRequested,
        activeRides,
        completedRides,
        cancelledRides,
        totalDrivers,
        availableDrivers,
        totalRevenue,
        currency: 'INR'
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch operational metrics.' });
  }
});

// All Rides (Live Monitoring & History)
router.get('/rides', async (req, res) => {
  try {
    const statusFilter = req.query.status;
    const rides = await prisma.ride.findMany({
      where: statusFilter ? { status: statusFilter } : {},
      include: {
        customer: { select: { name: true, phone: true } },
        driver: {
          include: {
            user: { select: { name: true, phone: true } },
            vehicles: true
          }
        },
        payments: true
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json({ success: true, count: rides.length, rides });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rides.' });
  }
});

// Driver Fleet Oversight
router.get('/drivers', async (req, res) => {
  try {
    const drivers = await prisma.driverProfile.findMany({
      include: {
        user: { select: { name: true, email: true, phone: true } },
        vehicles: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, count: drivers.length, drivers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch driver fleet.' });
  }
});

// Fare Configurations Management
router.get('/fares', async (req, res) => {
  try {
    const fares = await prisma.fareConfiguration.findMany();
    res.json({ success: true, fares });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load fares.' });
  }
});

router.put('/fares/:id', async (req, res) => {
  try {
    const { baseFare, perKmRate, perMinuteRate, minimumFare, surgeMultiplier, isActive } = req.body;

    const updated = await prisma.fareConfiguration.update({
      where: { id: req.params.id },
      data: {
        ...(baseFare !== undefined ? { baseFare: parseFloat(baseFare) } : {}),
        ...(perKmRate !== undefined ? { perKmRate: parseFloat(perKmRate) } : {}),
        ...(perMinuteRate !== undefined ? { perMinuteRate: parseFloat(perMinuteRate) } : {}),
        ...(minimumFare !== undefined ? { minimumFare: parseFloat(minimumFare) } : {}),
        ...(surgeMultiplier !== undefined ? { surgeMultiplier: parseFloat(surgeMultiplier) } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {})
      }
    });

    res.json({ success: true, message: 'Fare configuration updated.', fare: updated });
  } catch (err) {
    res.status(400).json({ error: 'Failed to update fare configuration.' });
  }
});

// Support Tickets
router.get('/tickets', async (req, res) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      include: {
        user: { select: { name: true, email: true, phone: true } },
        ride: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, count: tickets.length, tickets });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tickets.' });
  }
});

router.put('/tickets/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data: { status }
    });
    res.json({ success: true, ticket: updated });
  } catch (err) {
    res.status(400).json({ error: 'Failed to update ticket status.' });
  }
});

// System Health & Distributed Circuit Breakers
router.get('/health', (req, res) => {
  const cbStatus = circuitBreakers.getStatus();
  res.json({
    status: 'HEALTHY',
    serviceArea: 'Pune Metro (Maharashtra, India)',
    database: 'SQLite (Prisma ORM)',
    circuitBreakers: cbStatus,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
