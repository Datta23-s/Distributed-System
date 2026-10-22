// Authenticated WebSocket Room Manager & Real-Time Dispatcher
// Complies with Section 11 of UrbanPulse Master Spec

const { jwtAuth } = require('../middleware/auth');

class SocketManager {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // ws -> { userId, role, driverId, subscribedRooms: Set }
    this.driverPositions = new Map(); // driverId -> { lat, lng, heading, speed, updatedAt }
  }

  attach(wss) {
    this.wss = wss;

    wss.on('connection', (ws, req) => {
      // Default connection state
      const clientMeta = {
        userId: null,
        role: 'ANONYMOUS',
        driverId: null,
        subscribedRooms: new Set()
      };
      this.clients.set(ws, clientMeta);

      // Send initial welcome & capability handshake
      ws.send(JSON.stringify({
        type: 'SYSTEM_CONNECTED',
        message: 'Connected to UrbanPulse Real-Time Gateway (Pune)',
        timestamp: new Date().toISOString()
      }));

      ws.on('message', (data) => {
        try {
          const payload = JSON.parse(data.toString());
          this.handleClientMessage(ws, payload);
        } catch (err) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Malformed JSON frame.' }));
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', (err) => {
        console.error('WebSocket client error:', err.message);
        this.clients.delete(ws);
      });
    });

    console.log('[SocketManager] Attached to WebSocket Server.');
  }

  handleClientMessage(ws, payload) {
    const meta = this.clients.get(ws);
    if (!meta) return;

    switch (payload.type) {
      // Authenticate socket session with JWT
      case 'AUTHENTICATE': {
        const token = payload.token;
        if (!token) {
          return ws.send(JSON.stringify({ type: 'AUTH_FAILED', error: 'Missing token' }));
        }
        try {
          const decoded = jwtAuth.verifyToken(token);
          meta.userId = decoded.userId || decoded.sub;
          meta.role = decoded.role || 'CUSTOMER';
          meta.driverId = decoded.driverId || null;

          // Auto-join personal room
          meta.subscribedRooms.add(`user:${meta.userId}`);
          if (meta.role === 'CUSTOMER') {
            meta.subscribedRooms.add(`customer:${meta.userId}`);
          }
          if (meta.role === 'DRIVER' && meta.driverId) {
            meta.subscribedRooms.add(`driver:${meta.driverId}`);
          }
          if (meta.role === 'ADMIN') {
            meta.subscribedRooms.add('admin');
          }

          ws.send(JSON.stringify({
            type: 'AUTH_SUCCESS',
            user: { userId: meta.userId, role: meta.role },
            rooms: Array.from(meta.subscribedRooms)
          }));
        } catch (err) {
          ws.send(JSON.stringify({ type: 'AUTH_FAILED', error: 'Invalid or expired token' }));
        }
        break;
      }

      // Join a specific ride tracking room
      case 'SUBSCRIBE_RIDE': {
        if (payload.rideId) {
          meta.subscribedRooms.add(`ride:${payload.rideId}`);
          ws.send(JSON.stringify({
            type: 'SUBSCRIBED',
            room: `ride:${payload.rideId}`
          }));
        }
        break;
      }

      // Driver live GPS telemetry broadcast
      case 'DRIVER_TELEMETRY': {
        if (meta.role !== 'DRIVER' || !meta.driverId) {
          return ws.send(JSON.stringify({ type: 'UNAUTHORIZED' }));
        }

        const { latitude, longitude, heading = 0, speed = 0, rideId } = payload;
        const telemetry = {
          driverId: meta.driverId,
          latitude,
          longitude,
          heading,
          speed,
          updatedAt: new Date().toISOString()
        };

        this.driverPositions.set(meta.driverId, telemetry);

        // Broadcast to ride room if on an active trip
        if (rideId) {
          this.broadcastToRoom(`ride:${rideId}`, 'DRIVER_LOCATION_UPDATE', telemetry);
        }
        // Broadcast to admin room for fleet live-view
        this.broadcastToRoom('admin', 'FLEET_DRIVER_UPDATE', telemetry);
        break;
      }

      case 'PING': {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        break;
      }

      default:
        break;
    }
  }

  // Notify customer specifically
  notifyCustomer(customerId, eventType, data) {
    this.broadcastToRoom(`customer:${customerId}`, eventType, data);
    this.broadcastToRoom(`user:${customerId}`, eventType, data);
  }

  // Notify driver specifically
  notifyDriver(driverId, eventType, data) {
    this.broadcastToRoom(`driver:${driverId}`, eventType, data);
  }

  // Notify all participants in a ride room
  notifyRide(rideId, eventType, data) {
    this.broadcastToRoom(`ride:${rideId}`, eventType, data);
    // Also mirror to admin oversight
    this.broadcastToRoom('admin', `RIDE_EVENT:${eventType}`, { rideId, ...data });
  }

  // Room-based multi-cast
  broadcastToRoom(roomName, eventType, data) {
    const payloadStr = JSON.stringify({
      type: eventType,
      room: roomName,
      data,
      timestamp: new Date().toISOString()
    });

    for (const [ws, meta] of this.clients.entries()) {
      if (ws.readyState === 1 && meta.subscribedRooms && meta.subscribedRooms.has(roomName)) {
        ws.send(payloadStr);
      }
    }
  }
}

module.exports = new SocketManager();
