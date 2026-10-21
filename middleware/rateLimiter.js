/**
 * ============================================================================
 * UNIT 4 & UNIT 2: DISTRIBUTED RATE LIMITING & THROTTLING
 * Module: middleware/rateLimiter.js
 * ============================================================================
 *
 * Implements dual-algorithm API rate limiting:
 * 1. Token Bucket Algorithm: Burstable capacity with smooth refill rate.
 * 2. Sliding Window Counter: Per-minute traffic shaping.
 * 3. Per-endpoint tiers (Estimate: 50/min, Booking: 20/min, Admin: 10/min).
 * 4. Distributed state coordination with Replicated Quorum KV Store.
 * 5. Standards-compliant HTTP 429 Too Many Requests with Retry-After headers.
 */

class TokenBucket {
  constructor(capacity = 60, refillRatePerSec = 10) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRatePerSec = refillRatePerSec;
    this.lastRefill = Date.now();
  }

  refill() {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefill) / 1000;
    const addedTokens = elapsedSec * this.refillRatePerSec;
    this.tokens = Math.min(this.capacity, this.tokens + addedTokens);
    this.lastRefill = now;
  }

  consume(tokens = 1) {
    this.refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }

  getRemaining() {
    this.refill();
    return Math.floor(this.tokens);
  }
}

class DistributedRateLimiter {
  constructor(quorumKvStore = null) {
    this.quorumKvStore = quorumKvStore;
    this.buckets = new Map(); // key -> TokenBucket
    this.slidingWindows = new Map(); // key -> Array<timestamps>

    this.limits = {
      estimate: { limit: 50, windowMs: 60000, bucketCap: 30, refillRate: 5 },
      booking: { limit: 20, windowMs: 60000, bucketCap: 15, refillRate: 2 },
      admin: { limit: 10, windowMs: 60000, bucketCap: 8, refillRate: 1 },
      default: { limit: 100, windowMs: 60000, bucketCap: 60, refillRate: 10 }
    };

    this.metrics = {
      totalRequests: 0,
      allowedRequests: 0,
      throttledRequests: 0
    };
  }

  setQuorumStore(kvStore) {
    this.quorumKvStore = kvStore;
  }

  getCategory(urlPath) {
    if (urlPath.includes('/estimate')) return 'estimate';
    if (urlPath.includes('/request') || urlPath.includes('/booking')) return 'booking';
    if (urlPath.includes('/kill_') || urlPath.includes('/recover_') || urlPath.includes('/election') || urlPath.includes('/snapshot')) return 'admin';
    return 'default';
  }

  async checkLimit(clientIp, urlPath) {
    this.metrics.totalRequests++;
    const category = this.getCategory(urlPath);
    const tier = this.limits[category] || this.limits.default;
    const key = `${clientIp}:${category}`;

    // 1. Check & Update Token Bucket
    if (!this.buckets.has(key)) {
      this.buckets.set(key, new TokenBucket(tier.bucketCap, tier.refillRate));
    }
    const bucket = this.buckets.get(key);
    const hasTokens = bucket.consume(1);

    // 2. Sliding Window Counter
    const now = Date.now();
    if (!this.slidingWindows.has(key)) {
      this.slidingWindows.set(key, []);
    }
    const windowList = this.slidingWindows.get(key);
    const windowStart = now - tier.windowMs;

    // Prune expired entries
    while (windowList.length > 0 && windowList[0] < windowStart) {
      windowList.shift();
    }

    if (!hasTokens || windowList.length >= tier.limit) {
      this.metrics.throttledRequests++;
      const oldestTs = windowList[0] || now;
      const retryAfterSec = Math.max(1, Math.ceil((oldestTs + tier.windowMs - now) / 1000));

      return {
        allowed: false,
        category,
        limit: tier.limit,
        remaining: 0,
        retryAfterSec,
        reason: hasTokens ? 'Sliding window limit exceeded' : 'Token bucket exhausted'
      };
    }

    // Record request
    windowList.push(now);
    this.metrics.allowedRequests++;

    // Asynchronously synchronize distributed counter with Quorum KV Store
    if (this.quorumKvStore) {
      const kvKey = `ratelimit:${clientIp}:${category}`;
      this.quorumKvStore.write(kvKey, String(windowList.length)).catch(() => {});
    }

    return {
      allowed: true,
      category,
      limit: tier.limit,
      remaining: Math.max(0, tier.limit - windowList.length),
      tokensAvailable: bucket.getRemaining()
    };
  }

  createMiddleware() {
    return async (req, res, next) => {
      // Whitelist static dashboard assets
      if (req.path.startsWith('/css') || req.path.startsWith('/js') || req.path === '/' || req.path === '/index.html') {
        return next();
      }

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      const result = await this.checkLimit(clientIp, req.path);

      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);

      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfterSec);
        return res.status(429).json({
          status: 'ERROR',
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too Many Requests. Rate limit of ${result.limit} req/min exceeded for '${result.category}'. Please retry after ${result.retryAfterSec}s.`,
          retryAfterSeconds: result.retryAfterSec,
          tier: result.category
        });
      }

      next();
    };
  }

  getStatus() {
    const clients = [];
    for (const [key, window] of this.slidingWindows.entries()) {
      const [ip, cat] = key.split(':');
      clients.push({
        clientIp: ip,
        category: cat,
        activeRequestsInWindow: window.length,
        tokens: this.buckets.get(key) ? this.buckets.get(key).getRemaining() : 0
      });
    }

    return {
      metrics: this.metrics,
      limits: this.limits,
      activeClients: clients.slice(0, 10)
    };
  }
}

const rateLimiter = new DistributedRateLimiter();

module.exports = {
  DistributedRateLimiter,
  TokenBucket,
  rateLimiter
};
