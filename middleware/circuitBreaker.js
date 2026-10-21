/**
 * ============================================================================
 * UNIT 4 & UNIT 2: CIRCUIT BREAKER PATTERN (Hystrix-Inspired)
 * Module: middleware/circuitBreaker.js
 * ============================================================================
 *
 * Implements fault isolation and cascading failure prevention:
 * 1. Tri-state state machine: CLOSED (healthy), OPEN (tripped / fail-fast), HALF-OPEN (probe recovery).
 * 2. Consecutive failure threshold trigger (trips after N failures).
 * 3. Cooldown timer and automatic probe transition.
 * 4. Fallback execution returning graceful cached/default values when downstream is offline.
 * 5. Per-service circuit registry for Coordinator RPC, MOM Broker, DFS, Ledger, and KV Store.
 */

const STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
};

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeoutMs = options.resetTimeoutMs || 15000;
    this.successThreshold = options.successThreshold || 2;
    this.defaultFallback = options.fallback || (() => ({ status: 'FALLBACK_DEGRADED', reason: 'Circuit Open' }));

    this.state = STATES.CLOSED;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;

    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      fallbackCalls: 0,
      tripCount: 0
    };
  }

  async execute(actionFn, customFallback = null) {
    this.stats.totalCalls++;
    const now = Date.now();

    // Check if OPEN cooldown has expired -> transition to HALF-OPEN
    if (this.state === STATES.OPEN) {
      if (now >= this.nextAttemptTime) {
        this.state = STATES.HALF_OPEN;
        this.consecutiveSuccesses = 0;
      } else {
        // Fail fast without invoking downstream
        this.stats.fallbackCalls++;
        const fallbackFn = customFallback || this.defaultFallback;
        return fallbackFn(new Error(`CircuitBreaker '${this.name}' is OPEN (Fail-fast)`));
      }
    }

    try {
      const result = await actionFn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure(err);
      this.stats.fallbackCalls++;
      const fallbackFn = customFallback || this.defaultFallback;
      return fallbackFn(err);
    }
  }

  _onSuccess() {
    this.stats.successfulCalls++;
    this.consecutiveFailures = 0;

    if (this.state === STATES.HALF_OPEN) {
      this.consecutiveSuccesses++;
      if (this.consecutiveSuccesses >= this.successThreshold) {
        this.state = STATES.CLOSED;
        this.consecutiveSuccesses = 0;
      }
    }
  }

  _onFailure(err) {
    this.stats.failedCalls++;
    this.lastFailureTime = Date.now();
    this.consecutiveFailures++;

    if (this.state === STATES.HALF_OPEN || this.consecutiveFailures >= this.failureThreshold) {
      this.state = STATES.OPEN;
      this.stats.tripCount++;
      this.nextAttemptTime = Date.now() + this.resetTimeoutMs;
    }
  }

  trip() {
    this.state = STATES.OPEN;
    this.stats.tripCount++;
    this.nextAttemptTime = Date.now() + this.resetTimeoutMs;
  }

  reset() {
    this.state = STATES.CLOSED;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.nextAttemptTime = null;
  }

  getStatus() {
    return {
      name: this.name,
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      failureThreshold: this.failureThreshold,
      resetTimeoutMs: this.resetTimeoutMs,
      nextAttemptInMs: this.nextAttemptTime ? Math.max(0, this.nextAttemptTime - Date.now()) : 0,
      stats: { ...this.stats }
    };
  }
}

class CircuitBreakerRegistry {
  constructor() {
    this.breakers = new Map();

    // Initialize core distributed microservice breakers
    this.register('coordinator_rpc', {
      failureThreshold: 5,
      resetTimeoutMs: 15000,
      fallback: () => ({ status: 'FALLBACK', fare: 25.0, surge: 1.0, note: 'Default estimate from Circuit Breaker cache' })
    });

    this.register('mom_broker', {
      failureThreshold: 4,
      resetTimeoutMs: 12000,
      fallback: () => ({ status: 'FALLBACK_LOCAL_QUEUE', note: 'Queued to local in-memory fallback' })
    });

    this.register('dfs_namenode', {
      failureThreshold: 4,
      resetTimeoutMs: 15000,
      fallback: () => ({ status: 'FALLBACK_LOCAL_STORAGE', note: 'Written to ephemeral fallback node' })
    });

    this.register('blockchain_ledger', {
      failureThreshold: 4,
      resetTimeoutMs: 15000,
      fallback: () => ({ status: 'FALLBACK_PENDING_BLOCK', note: 'Queued for mining when ledger recovers' })
    });

    this.register('quorum_kv', {
      failureThreshold: 3,
      resetTimeoutMs: 10000,
      fallback: () => ({ status: 'FALLBACK_READ_LOCAL', note: 'Returned local stale replica value' })
    });
  }

  register(name, options = {}) {
    const breaker = new CircuitBreaker(name, options);
    this.breakers.set(name, breaker);
    return breaker;
  }

  get(name) {
    if (!this.breakers.has(name)) {
      return this.register(name);
    }
    return this.breakers.get(name);
  }

  getAllStatuses() {
    const list = {};
    for (const [name, breaker] of this.breakers.entries()) {
      list[name] = breaker.getStatus();
    }
    return list;
  }
}

const circuitRegistry = new CircuitBreakerRegistry();

module.exports = {
  CircuitBreaker,
  CircuitBreakerRegistry,
  circuitRegistry,
  STATES
};
