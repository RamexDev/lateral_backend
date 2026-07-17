/**
 * Pluggable cache abstraction.
 * - In production: backed by Redis (ioredis).
 * - In tests / dev: in-memory Map.
 *
 * Only used for non-critical caches (feed cache, bot sessions, rate-limit counters).
 * Anything stored here must be safely reconstructable from MySQL.
 */

const config = require('../config');

let backend = null;

/**
 * In-memory cache — used when REDIS_URL is unset (dev/test).
 * Mimics the small subset of Redis commands we use: get/setex/del/exists.
 */
function createMemoryBackend() {
  const store = new Map();
  return {
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key, value, ttlSeconds) {
      const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
      store.set(key, { value, expiresAt });
    },
    /**
     * Atomic set-if-not-exists with TTL. Returns true if the value was set
     * (key didn't exist), false otherwise. Mirrors Redis's `SET key value NX EX ttl`.
     *
     * Used by the purchase double-charge mutex (§7) so the lock can never leak
     * even if the process crashes between acquire and TTL-set.
     */
    async add(key, value, ttlSeconds) {
      const existing = store.get(key);
      if (existing && (!existing.expiresAt || existing.expiresAt > Date.now())) {
        return false;
      }
      const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
      store.set(key, { value, expiresAt });
      return true;
    },
    async setex(key, ttlSeconds, value) {
      return this.set(key, value, ttlSeconds);
    },
    async del(key) {
      store.delete(key);
    },
    async exists(key) {
      const entry = store.get(key);
      if (!entry) return 0;
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        store.delete(key);
        return 0;
      }
      return 1;
    },
    async incr(key) {
      const entry = store.get(key);
      const next = (entry?.value || 0) + 1;
      store.set(key, { value: next, expiresAt: entry?.expiresAt ?? null });
      return next;
    },
    async expire(key, ttlSeconds) {
      const entry = store.get(key);
      if (!entry) return 0;
      entry.expiresAt = Date.now() + ttlSeconds * 1000;
      return 1;
    },
    async flushall() {
      store.clear();
    },
    _store: store,
  };
}

/**
 * Lazy-init Redis backend. Falls back to in-memory if REDIS_URL is unset or connection fails.
 */
async function getBackend() {
  if (backend) return backend;

  if (config.redis.url && !config.isTest) {
    try {
      // Lazy require so tests never spawn a Redis client.
      const IORedis = require('ioredis');
      backend = new IORedis(config.redis.url, { maxRetriesPerRequest: 2, lazyConnect: false });
      // Graceful fallback on connection error.
      backend.on('error', (err) => {
        // eslint-disable-next-line no-console
        console.warn('[cache] Redis error, falling back to in-memory:', err.message);
        backend = createMemoryBackend();
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[cache] Redis init failed, using in-memory:', err.message);
      backend = createMemoryBackend();
    }
  } else {
    backend = createMemoryBackend();
  }

  return backend;
}

/**
 * Synchronously get the current backend (may be null if not yet initialized).
 * Used by tests where we want the memory backend explicitly.
 */
function peekBackend() {
  return backend;
}

/**
 * Test helper: force the cache into in-memory mode and clear it.
 */
function resetForTests() {
  backend = createMemoryBackend();
  return backend;
}

module.exports = { getBackend, peekBackend, resetForTests, createMemoryBackend };
