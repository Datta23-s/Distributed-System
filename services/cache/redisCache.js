/**
 * ============================================================================
 * UNIT 4 & UNIT 1: REDIS-COMPATIBLE IN-MEMORY CACHE LAYER
 * Module: services/cache/redisCache.js
 * ============================================================================
 *
 * Implements a low-latency in-memory cache layer:
 * 1. Cache-Aside pattern: Queries cache first; queries storage on miss and caches result.
 * 2. O(1) LRU (Least Recently Used) eviction policy with configurable max entries.
 * 3. Configurable TTL (Time-To-Live) expiration per cached key.
 * 4. Namespaced key storage (`dfs:*`, `kv:*`, `ledger:*`, `fare:*`).
 * 5. Distributed Cache Invalidation via MOM pub/sub topic `cache.invalidate`.
 * 6. Cache analytics: Hit count, miss count, hit ratio, latency saved.
 */

class CacheEntry {
  constructor(key, value, ttlMs = 60000) {
    this.key = key;
    this.value = value;
    this.createdAt = Date.now();
    this.expiresAt = ttlMs > 0 ? this.createdAt + ttlMs : null;
    this.lastAccessed = this.createdAt;
    this.hits = 0;
  }

  isExpired() {
    return this.expiresAt !== null && Date.now() > this.expiresAt;
  }
}

class RedisCache {
  constructor(maxEntries = 500, defaultTtlMs = 60000, brokerClient = null) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
    this.brokerClient = brokerClient;
    this.cache = new Map(); // key -> CacheEntry (Map maintains insertion/access order)

    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      invalidations: 0
    };

    // Listen for distributed cache invalidations over MOM
    if (this.brokerClient) {
      this.brokerClient.subscribe('cache.invalidate', (topic, payload) => {
        if (payload && payload.key) {
          this.del(payload.key, false);
          this.metrics.invalidations++;
        }
      });
    }
  }

  setBrokerClient(client) {
    this.brokerClient = client;
    if (this.brokerClient) {
      this.brokerClient.subscribe('cache.invalidate', (topic, payload) => {
        if (payload && payload.key) {
          this.del(payload.key, false);
          this.metrics.invalidations++;
        }
      });
    }
  }

  get(key) {
    if (!this.cache.has(key)) {
      this.metrics.misses++;
      return null;
    }

    const entry = this.cache.get(key);
    if (entry.isExpired()) {
      this.cache.delete(key);
      this.metrics.misses++;
      return null;
    }

    // Refresh LRU order: delete and re-insert at tail
    this.cache.delete(key);
    entry.lastAccessed = Date.now();
    entry.hits++;
    this.cache.set(key, entry);

    this.metrics.hits++;
    return entry.value;
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    this.metrics.sets++;

    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict oldest entry (LRU head of map)
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.metrics.evictions++;
    }

    const entry = new CacheEntry(key, value, ttlMs);
    this.cache.set(key, entry);
    return true;
  }

  del(key, broadcast = true) {
    const deleted = this.cache.delete(key);
    if (broadcast && this.brokerClient) {
      this.brokerClient.publish('cache.invalidate', { key, timestamp: Date.now() }).catch(() => {});
    }
    return deleted;
  }

  flush(namespace = null) {
    if (!namespace) {
      const count = this.cache.size;
      this.cache.clear();
      return count;
    }

    let count = 0;
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(namespace)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  getKeys(namespace = null) {
    const keys = [];
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.isExpired()) continue;
      if (!namespace || key.startsWith(namespace)) {
        keys.push({
          key,
          hits: entry.hits,
          ttlRemainingSec: entry.expiresAt ? Math.max(0, Math.round((entry.expiresAt - now) / 1000)) : null,
          ageSec: Math.round((now - entry.createdAt) / 1000)
        });
      }
    }
    return keys;
  }

  getStats() {
    const total = this.metrics.hits + this.metrics.misses;
    const hitRatio = total > 0 ? Number(((this.metrics.hits / total) * 100).toFixed(1)) : 0;

    return {
      totalEntries: this.cache.size,
      maxEntries: this.maxEntries,
      hitRatioPercent: hitRatio,
      metrics: { ...this.metrics },
      memoryEstimatedKB: Number((this.cache.size * 0.45).toFixed(2)),
      estimatedLatencySavedMs: this.metrics.hits * 18
    };
  }
}

const globalCache = new RedisCache(500, 60000);

module.exports = {
  RedisCache,
  CacheEntry,
  globalCache
};
