const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      let respData = '';
      res.on('data', chunk => respData += chunk);
      res.on('end', () => resolve(JSON.parse(respData)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function testFlow() {
  console.log('Testing RPC Ride Estimate...');
  const estimate = await post('/api/ride/estimate', { pickup: [20, 20], dropoff: [60, 70] });
  console.log('Estimate Result:', estimate);

  console.log('\nTesting RPC Ride Request...');
  const booking = await post('/api/ride/request', { customerId: 'cust-test', pickup: [20, 20], dropoff: [60, 70] });
  console.log('Booking Result:', booking);

  console.log('\nTesting Fault Injection: Kill Driver 2...');
  const kill = await post('/api/fault/kill_driver', { driverId: 'driver-2' });
  console.log('Kill Result:', kill);

  console.log('\nTesting P2P Hazard Broadcast...');
  const hazard = await post('/api/p2p/hazard', { driverId: 'driver-1', hazardType: 'ACCIDENT', description: 'Car crash on 4th street' });
  console.log('Hazard Result:', hazard);
}

testFlow().catch(console.error);
