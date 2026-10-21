/**
 * ============================================================================
 * UNIT 4: EMERGING DISTRIBUTED PARADIGMS — SERVERLESS FAAS RUNTIME
 * Module: services/serverless/serverlessRuntime.js
 * ============================================================================
 *
 * WHICH FILE IMPLEMENTS WHAT:
 * - services/serverless/serverlessRuntime.js: Implements a standalone FaaS runtime
 *   daemon listening on port 9400:
 *   1. Function Registry: Stateless micro-functions (estimateFare, surgePricing, generateReceipt).
 *   2. Container Lifecycle & Cold Start Simulation: Simulates micro-VM/container boot delays
 *      (300-800ms) on first call or after 10s idle eviction, versus warm container reuse (5-15ms).
 *   3. Event-Driven Triggers: Subscribes to MOM broker topic 'rides.status'; COMPLETED events
 *      automatically trigger the 'generateReceipt' serverless function.
 *   4. Direct HTTP Invoker: POST /invoke/:functionName endpoint for synchronous execution.
 *
 * HOW TO DEMO TO EXAMINER:
 * 1. Open Dashboard -> "Unit 4: Emerging Paradigms" tab -> "Serverless FaaS Runtime".
 * 2. Click "Invoke estimateFare" -> Notice "[COLD START]" badge and ~400ms container boot latency.
 * 3. Immediately click "Invoke estimateFare" again -> Notice "[WARM START]" badge and ~8ms latency!
 * 4. Complete a ride in the simulator -> Watch the MOM event trigger 'generateReceipt' automatically!
 */

const http = require('http');
const { ServiceRegistry } = require('../../middleware/naming');
const { MessageBrokerClient } = require('../../middleware/broker');

const COLD_START_MIN = 300;
const COLD_START_MAX = 650;
const WARM_TIME_MIN = 6;
const WARM_TIME_MAX = 18;
const CONTAINER_IDLE_TIMEOUT_MS = 12000; // 12 seconds idle eviction

class ServerlessRuntime {
  constructor(port = 9400, brokerHost = '127.0.0.1', brokerPort = 9100) {
    this.port = port;
    this.brokerHost = brokerHost;
    this.brokerPort = brokerPort;
    this.registry = new ServiceRegistry();
    this.server = null;

    // Active containers: funcName -> { containerId, lastUsed, bootCount, invocations }
    this.containers = new Map();

    // Invocations log and metrics
    this.invocationLog = [];
    this.metrics = {
      totalInvocations: 0,
      coldStarts: 0,
      warmStarts: 0,
      avgLatencyMs: 0
    };

    // Registered serverless functions
    this.functions = {
      estimateFare: async (params) => {
        const { pickup = [20, 30], dropoff = [50, 60], trafficFactor = 1.1 } = params || {};
        const dist = Math.hypot(dropoff[0] - pickup[0], dropoff[1] - pickup[1]);
        const fare = Number((5.0 + dist * 1.75 * trafficFactor).toFixed(2));
        return {
          service: 'estimateFare',
          distanceKm: Number(dist.toFixed(2)),
          fare,
          etaMinutes: Math.max(3, Math.round(dist * 0.8))
        };
      },

      surgePricing: async (params) => {
        const { demand = 15, activeDrivers = 3, zone = 'Downtown' } = params || {};
        const ratio = activeDrivers > 0 ? demand / activeDrivers : 3.0;
        let multiplier = 1.0;
        if (ratio > 4.0) multiplier = 2.4;
        else if (ratio > 2.5) multiplier = 1.8;
        else if (ratio > 1.5) multiplier = 1.3;
        return {
          service: 'surgePricing',
          zone,
          demandIndex: demand,
          availableDrivers: activeDrivers,
          surgeMultiplier: multiplier,
          label: multiplier > 1.0 ? `${multiplier}x Surge Active` : 'Standard Rates'
        };
      },

      generateReceipt: async (params) => {
        const { tripId = 'trip-demo', customerId = 'cust-1', driverId = 'driver-1', fare = 24.50, distance = 6.4, tip = 4.00 } = params || {};
        const total = Number((fare + tip).toFixed(2));
        return {
          service: 'generateReceipt',
          receiptId: `rcpt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          tripId,
          customerId,
          driverId,
          baseFare: fare,
          tip,
          totalPaid: total,
          timestamp: new Date().toISOString()
        };
      },

      computeSurge: async (params) => {
        const { zone = 'Downtown', demand = 16, activeDrivers = 2, hourOfDay = new Date().getHours(), weatherCondition = 'CLEAR' } = params || {};
        const ratio = activeDrivers > 0 ? demand / activeDrivers : 4.0;
        const isRushHour = (hourOfDay >= 8 && hourOfDay <= 10) || (hourOfDay >= 17 && hourOfDay <= 21);
        const temporalFactor = isRushHour ? 1.25 : 1.0;
        const weatherFactor = weatherCondition === 'RAIN' ? 1.3 : 1.0;
        let rawSurge = 1.0 + Math.max(0, (ratio - 1.0) * 0.28) * temporalFactor * weatherFactor;
        const surgeMultiplier = Number(Math.min(3.5, Math.max(1.0, rawSurge)).toFixed(2));
        return {
          service: 'computeSurge',
          zone,
          demandIndex: demand,
          availableDrivers: activeDrivers,
          ratio: Number(ratio.toFixed(2)),
          rushHour: isRushHour,
          surgeMultiplier,
          modelConfidence: 0.94,
          label: surgeMultiplier > 1.0 ? `${surgeMultiplier}x AI Surge Dynamic` : 'Standard Rates (1.0x)'
        };
      }
    };

    // Support both camelCase and snake_case naming conventions
    this.functions.estimate_fare = this.functions.estimateFare;
    this.functions.surge_pricing = this.functions.surgePricing;
    this.functions.generate_receipt = this.functions.generateReceipt;
    this.functions.compute_surge = this.functions.computeSurge;

    // Register in directory service
    this.registry.register('service://serverless/runtime', '127.0.0.1', this.port, {
      type: 'faas_runtime',
      functions: Object.keys(this.functions)
    });
  }

  async start() {
    // 1. Start HTTP Server
    this.server = http.createServer(async (req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        return res.end();
      }

      const url = new URL(req.url, `http://localhost:${this.port}`);

      if (url.pathname === '/') {
        if (req.headers.accept && req.headers.accept.includes('text/html')) {
          res.writeHead(302, { 'Location': 'http://localhost:5000' });
          return res.end();
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          status: 'OK',
          service: 'UrbanPulse Serverless FaaS Runtime',
          dashboardUrl: 'http://localhost:5000',
          endpoints: ['/health', '/metrics', '/invoke/:functionName']
        }));
      }

      if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'OK', runtime: 'FaaS-Serverless', port: this.port }));
      }

      if (url.pathname === '/metrics') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(this.getMetrics()));
      }

      if (url.pathname.startsWith('/invoke/')) {
        const funcName = url.pathname.replace('/invoke/', '');
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', async () => {
          let params = {};
          if (body) {
            try { params = JSON.parse(body); } catch (e) {}
          }
          try {
            const result = await this.invoke(funcName, params, 'HTTP_DIRECT');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'OK', result }));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ERROR', message: err.message }));
          }
        });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ERROR', error: 'Endpoint not found' }));
    });

    await new Promise((resolve) => this.server.listen(this.port, '127.0.0.1', resolve));
    console.log(`[Serverless Runtime] Listening on port ${this.port} (Web Dashboard: http://localhost:5000)`);

    // 2. Connect to MOM Broker for Event-Driven Triggers
    try {
      this.brokerClient = new MessageBrokerClient(this.brokerHost, this.brokerPort);
      this.brokerClient.subscribe('rides.status', async (msg) => {
        if (msg && msg.status === 'COMPLETED') {
          // Event Trigger: Completed ride generates receipt automatically
          await this.invoke('generateReceipt', {
            tripId: msg.rideId || msg.tripId,
            customerId: msg.customerId,
            driverId: msg.driverId,
            fare: msg.fare || 25.00,
            distance: msg.distance || 7.2
          }, 'MOM_EVENT_TRIGGER:rides.status');
        }
      });
    } catch (e) {
      console.warn('[Serverless] MOM event broker trigger subscription deferred.');
    }
  }

  /**
   * Execute serverless function with simulated cold start or warm container reuse
   */
  async invoke(funcName, params = {}, triggerType = 'MANUAL') {
    const fn = this.functions[funcName];
    if (!fn) throw new Error(`Serverless function '${funcName}' is not registered!`);

    const now = Date.now();
    let container = this.containers.get(funcName);
    let isColdStart = false;
    let latencyMs = 0;

    // Check if container exists and is still warm
    if (!container || (now - container.lastUsed > CONTAINER_IDLE_TIMEOUT_MS)) {
      isColdStart = true;
      // Simulate container initialization & boot delay
      const bootDelay = Math.floor(Math.random() * (COLD_START_MAX - COLD_START_MIN)) + COLD_START_MIN;
      await new Promise((r) => setTimeout(r, bootDelay));

      container = {
        containerId: `cntr-${funcName}-${Math.floor(Math.random() * 10000)}`,
        bootCount: (container?.bootCount || 0) + 1,
        invocations: 0,
        lastUsed: Date.now()
      };
      this.containers.set(funcName, container);
      latencyMs = bootDelay;
    } else {
      // Warm container reuse
      const execDelay = Math.floor(Math.random() * (WARM_TIME_MAX - WARM_TIME_MIN)) + WARM_TIME_MIN;
      await new Promise((r) => setTimeout(r, execDelay));
      latencyMs = execDelay;
    }

    // Run user function
    const output = await fn(params);
    container.lastUsed = Date.now();
    container.invocations += 1;

    // Metrics & Logging
    this.metrics.totalInvocations += 1;
    if (isColdStart) this.metrics.coldStarts += 1;
    else this.metrics.warmStarts += 1;

    const entry = {
      id: `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      time: new Date().toLocaleTimeString(),
      funcName,
      containerId: container.containerId,
      triggerType,
      isColdStart,
      latencyMs,
      output,
      timestamp: Date.now()
    };

    this.invocationLog.unshift(entry);
    if (this.invocationLog.length > 50) this.invocationLog.pop();

    return entry;
  }

  getMetrics() {
    return {
      status: 'OK',
      port: this.port,
      registeredFunctions: Object.keys(this.functions),
      activeContainers: Array.from(this.containers.entries()).map(([fn, c]) => ({
        function: fn,
        containerId: c.containerId,
        isWarm: (Date.now() - c.lastUsed) <= CONTAINER_IDLE_TIMEOUT_MS,
        idleSeconds: Math.round((Date.now() - c.lastUsed) / 1000),
        invocations: c.invocations
      })),
      metrics: this.metrics,
      history: this.invocationLog.slice(0, 20)
    };
  }

  stop() {
    if (this.server) this.server.close();
  }
}

module.exports = { ServerlessRuntime };

if (require.main === module) {
  const rt = new ServerlessRuntime();
  rt.start();
}
