// Authentication Routes: Register, Login, Session, Logout
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../../services/db');
const { jwtAuth } = require('../../middleware/auth');

// Register Customer or Driver
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, role = 'CUSTOMER', licenseNumber, vehicleCategory } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, ...(phone ? [{ phone }] : [])]
      }
    });

    if (existing) {
      return res.status(409).json({ error: 'User with this email or phone already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        passwordHash,
        role: role.toUpperCase(),
        ...(role.toUpperCase() === 'CUSTOMER' ? {
          customerProfile: {
            create: { rating: 5.0, totalRides: 0 }
          }
        } : {}),
        ...(role.toUpperCase() === 'DRIVER' ? {
          driverProfile: {
            create: {
              licenseNumber: licenseNumber || `MH12-GEN-${Date.now().toString().slice(-6)}`,
              status: 'AVAILABLE',
              rating: 5.0,
              vehicles: {
                create: {
                  category: vehicleCategory || 'ECONOMY',
                  make: 'Maruti Suzuki',
                  model: 'WagonR',
                  year: 2022,
                  licensePlate: `MH 12 DG ${Math.floor(1000 + Math.random() * 9000)}`,
                  color: 'Silver',
                  capacity: 4,
                  isApproved: true
                }
              }
            }
          }
        } : {})
      },
      include: {
        customerProfile: true,
        driverProfile: { include: { vehicles: true } }
      }
    });

    const token = jwtAuth.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      driverId: user.driverProfile ? user.driverProfile.id : null
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        driverProfile: user.driverProfile || null,
        customerProfile: user.customerProfile || null
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        customerProfile: true,
        driverProfile: { include: { vehicles: true } }
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwtAuth.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      driverId: user.driverProfile ? user.driverProfile.id : null
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        driverProfile: user.driverProfile || null,
        customerProfile: user.customerProfile || null
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// Current Authenticated Session
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No authorization token provided.' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwtAuth.verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId || decoded.sub },
      include: {
        customerProfile: true,
        driverProfile: { include: { vehicles: true } },
        savedPlaces: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      customerProfile: user.customerProfile,
      driverProfile: user.driverProfile,
      savedPlaces: user.savedPlaces
    });
  } catch (err) {
    res.status(401).json({ error: 'Session expired or invalid.' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully.' });
});

module.exports = router;
