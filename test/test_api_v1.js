// Automated Integration Test Suite for UrbanPulse Dispatch API v1
// Tests customer registration, login, Pune geocoding, fare quotes, booking, driver acceptance, PIN verification, trip completion, receipt, and admin metrics.

const assert = require('assert');
const http = require('http');

const BASE_URL = 'http://localhost:5000/api/v1';

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const prisma = require('../services/db');

async function runTests() {
  console.log('\n============================================================');
  console.log('🧪 Starting UrbanPulse Dispatch API v1 Automated Test Suite');
  console.log('============================================================\n');

  // Reset driver status to AVAILABLE for reproducible test runs
  await prisma.driverProfile.updateMany({
    data: { status: 'AVAILABLE' }
  });

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  let customerToken = null;
  let driverToken = null;
  let adminToken = null;
  let quoteId = null;
  let createdRideId = null;
  let tripPin = null;
  let assignmentId = null;

  // 1. Customer Login
  await test('Customer Login with seeded account', async () => {
    const res = await makeRequest('POST', '/auth/login', {
      email: 'customer@urbanpulse.in',
      password: 'Password@123'
    });
    assert.strictEqual(res.status, 200);
    assert(res.data.token, 'Token must be returned');
    assert.strictEqual(res.data.user.role, 'CUSTOMER');
    customerToken = res.data.token;
  });

  // 2. Driver Login
  await test('Driver Login with seeded account', async () => {
    const res = await makeRequest('POST', '/auth/login', {
      email: 'driver1@urbanpulse.in',
      password: 'Password@123'
    });
    assert.strictEqual(res.status, 200);
    assert(res.data.token, 'Token must be returned');
    assert.strictEqual(res.data.user.role, 'DRIVER');
    driverToken = res.data.token;
  });

  // 3. Admin Login
  await test('Admin Login with seeded account', async () => {
    const res = await makeRequest('POST', '/auth/login', {
      email: 'admin@urbanpulse.in',
      password: 'Password@123'
    });
    assert.strictEqual(res.status, 200);
    assert(res.data.token, 'Token must be returned');
    assert.strictEqual(res.data.user.role, 'ADMIN');
    adminToken = res.data.token;
  });

  // 4. Map Geocoding Search
  await test('Pune Landmark Geocoding Search', async () => {
    const res = await makeRequest('GET', '/maps/search?q=Hinjewadi');
    assert.strictEqual(res.status, 200);
    assert(res.data.results.length > 0, 'Should return matching Pune landmarks');
    const first = res.data.results[0];
    assert(first.name.includes('Hinjewadi'), 'Result must match Hinjewadi');
  });

  // 5. Route Calculation
  await test('Route Calculation (Shivajinagar to Hinjewadi Phase 1)', async () => {
    const res = await makeRequest('POST', '/maps/route', {
      startLat: 18.5314,
      startLng: 73.8446,
      endLat: 18.5912,
      endLng: 73.7389
    });
    assert.strictEqual(res.status, 200);
    assert(res.data.route.distanceKm > 10, 'Distance should be realistic road distance (> 10km)');
    assert(res.data.route.durationMinutes > 15, 'Duration should reflect Pune traffic (> 15 mins)');
    assert(res.data.route.routeGeometry.length > 5, 'Route geometry should have waypoints');
  });

  // 6. Fare Quotes Generation
  await test('Server-side Fare Quotes Calculation across tiers (INR)', async () => {
    const res = await makeRequest('POST', '/fares/quote', {
      pickupAddress: 'FC Road, Shivajinagar, Pune',
      pickupLat: 18.5314,
      pickupLng: 73.8446,
      destAddress: 'Hinjewadi Phase 1, Pune',
      destLat: 18.5912,
      destLng: 73.7389
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.currency, 'INR');
    assert.strictEqual(res.data.quotes.length, 4, 'Should quote BIKE, AUTO, ECONOMY, PREMIUM');
    
    // Find economy quote
    const economy = res.data.quotes.find(q => q.category === 'ECONOMY');
    assert(economy, 'ECONOMY quote must exist');
    assert(economy.totalFare > 100, 'Economy cab fare should be reasonable');
    quoteId = economy.quoteId;
  });

  // 7. Customer Ride Booking
  await test('Persistent Ride Booking Creation', async () => {
    const res = await makeRequest('POST', '/rides/book', {
      quoteId,
      vehicleCategory: 'ECONOMY',
      pickupAddress: 'FC Road, Shivajinagar, Pune',
      pickupLat: 18.5314,
      pickupLng: 73.8446,
      destAddress: 'Hinjewadi Phase 1, Pune',
      destLat: 18.5912,
      destLng: 73.7389,
      distanceKm: 14.5,
      durationMinutes: 35,
      estimatedFare: 295
    }, customerToken);

    assert.strictEqual(res.status, 201);
    assert(res.data.rideId, 'Ride ID must be created');
    assert(res.data.tripPin, '4-digit trip PIN must be generated');
    assert.strictEqual(res.data.currency, 'INR');
    
    createdRideId = res.data.rideId;
    tripPin = res.data.tripPin;
  });

  // 8. Driver Polls / Receives Offer
  await test('Driver receives pending assignment offer', async () => {
    // Allow brief async dispatch processing
    await new Promise(r => setTimeout(r, 600));

    const res = await makeRequest('GET', '/driver/offers', null, driverToken);
    assert.strictEqual(res.status, 200);
    assert(res.data.offer, 'Driver should receive offered ride');
    assert.strictEqual(res.data.offer.rideId, createdRideId);
    assignmentId = res.data.offer.id;
  });

  // 9. Driver Accepts Offer
  await test('Driver accepts offered ride assignment atomically', async () => {
    const res = await makeRequest('POST', `/driver/assignments/${assignmentId}/accept`, {}, driverToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.ride.status, 'DRIVER_ASSIGNED');
  });

  // 10. Driver En Route to Pickup
  await test('Driver marks en route to pickup', async () => {
    const res = await makeRequest('POST', `/driver/rides/${createdRideId}/arriving`, {}, driverToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.ride.status, 'DRIVER_ARRIVING');
  });

  // 11. Driver Arrives at Pickup
  await test('Driver marks arrival at pickup', async () => {
    const res = await makeRequest('POST', `/driver/rides/${createdRideId}/arrived`, {}, driverToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.ride.status, 'DRIVER_ARRIVED');
  });

  // 11. PIN Verification & Trip Start
  await test('Driver verifies 4-digit PIN and starts trip', async () => {
    // Test invalid PIN rejection first
    const failRes = await makeRequest('POST', `/driver/rides/${createdRideId}/verify-pin`, { tripPin: '0000' }, driverToken);
    assert.strictEqual(failRes.status, 400);

    // Verify with actual PIN
    const passRes = await makeRequest('POST', `/driver/rides/${createdRideId}/verify-pin`, { tripPin }, driverToken);
    assert.strictEqual(passRes.status, 200);
    assert.strictEqual(passRes.data.ride.status, 'IN_PROGRESS');
  });

  // 12. Trip Completion
  await test('Driver marks trip completed and produces final fare', async () => {
    const res = await makeRequest('POST', `/driver/rides/${createdRideId}/complete`, {}, driverToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.ride.status, 'COMPLETED');
    assert(res.data.ride.finalFare > 0, 'Final fare must be calculated');
  });

  // 13. Customer Receipt Retrieval
  await test('Customer retrieves itemized receipt for completed ride', async () => {
    const res = await makeRequest('GET', `/customer/receipt/${createdRideId}`, null, customerToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.receipt.status, 'COMPLETED');
    assert(res.data.receipt.fare.breakdown.baseFare > 0, 'Base fare must be broken down');
    assert(res.data.receipt.driver.name, 'Driver name must be in receipt');
  });

  // 14. Customer Rating
  await test('Customer submits rating and review for driver', async () => {
    const res = await makeRequest('POST', `/rides/${createdRideId}/rate`, {
      score: 5,
      feedback: 'Excellent driving on Pune-Bangalore highway!'
    }, customerToken);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.rating.score, 5);
  });

  // 15. Admin Operations Overview
  await test('Admin retrieves live operational metrics and revenue', async () => {
    const res = await makeRequest('GET', '/admin/overview', null, adminToken);
    assert.strictEqual(res.status, 200);
    assert(res.data.metrics.completedRides >= 1, 'Should record at least 1 completed ride');
    assert(res.data.metrics.totalRevenue >= 100, 'Recorded payment revenue should be tracked');
  });

  // 16. Recent Fleet Trips Feed (Dashboard API)
  await test('Retrieve live fleet trips feed (/rides/recent) with relations', async () => {
    const res = await makeRequest('GET', '/rides/recent');
    assert.strictEqual(res.status, 200);
    assert(res.data.success, 'Success flag must be true');
    assert(Array.isArray(res.data.rides), 'Must return array of rides');
    assert(res.data.rides.length > 0, 'Should have recent rides');
    const first = res.data.rides[0];
    assert(first.rideNumber, 'Ride must include rideNumber');
    assert(first.customer, 'Ride must include customer relation');
  });

  console.log('\n============================================================');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
