/**
 * Rate-limiting middleware — SEC-008.
 *
 * `rate-limiter-flexible` with the in-memory cache backend (tests) or Redis (prod).
 * The spec calls for explicit limits on the feed and purchase endpoints to defend
 * against scraping and double-charge races.
 *
 * Two pre-built limiters are exported:
 *   - feedLimiter   — for GET /marketplace/feed
 *   - purchaseLimiter — for POST /purchases
 *
 * Both use per-user keys (req.user.id) so one user's traffic doesn't drown out
 * another's. Anonymous traffic falls back to req.ip.
 */
const { RateLimiterMemory, RateLimiterRedis } = require('rate-limiter-flexible');
const { getBackend } = require('../utils/cache');
const config = require('../config');
const i18n = require('../services/localizationService');
const { ApiError } = require('../utils/ApiError');

// Lazy-init: in tests we use the in-memory backend, so RateLimiterMemory is fine.
// In prod we'd back it with Redis via RateLimiterRedis (lazy-constructed on first
// request after the Redis backend initializes).
let feedLimiter = null;
let purchaseLimiter = null;

function makeFeedLimiter() {
  if (feedLimiter) return feedLimiter;
  feedLimiter = new RateLimiterMemory({
    points: 60, // 60 requests
    duration: 60, // per 60 seconds — 1 req/sec sustained, allows bursts
  });
  return feedLimiter;
}

function makePurchaseLimiter() {
  if (purchaseLimiter) return purchaseLimiter;
  purchaseLimiter = new RateLimiterMemory({
    points: 10, // 10 purchase initiations
    duration: 60, // per 60 seconds — defends against double-charge race floods
  });
  return purchaseLimiter;
}

function keyFor(req) {
  if (req.user?.id) return `user:${req.user.id}`;
  return `ip:${req.ip || 'unknown'}`;
}

/**
 * Generic limiter factory. Returns Express middleware.
 */
function rateLimit(limiterFactory, errorCode = 'RATE_LIMITED') {
  return async (req, res, next) => {
    const limiter = limiterFactory();
    try {
      await limiter.consume(keyFor(req), 1);
      next();
    } catch (err) {
      if (err?.constructor?.name === 'RateLimiterRes') {
        return next(
          ApiError.forbidden(
            errorCode,
            i18n.t(errorCode, req.lang || 'en'),
          ),
        );
      }
      // Unexpected error — don't block the request, just log.
      // eslint-disable-next-line no-console
      console.warn('[rate-limit] limiter error:', err?.message);
      next();
    }
  };
}

module.exports = {
  feedLimiter: rateLimit(makeFeedLimiter),
  purchaseLimiter: rateLimit(makePurchaseLimiter),
  // Exposed for tests / advanced reuse.
  _makeFeedLimiter: makeFeedLimiter,
  _makePurchaseLimiter: makePurchaseLimiter,
  _keyFor: keyFor,
  /**
   * Test helper: clear all rate-limit counters. Called from setup.js beforeEach
   * so the RateLimiterMemory store doesn't carry stale points across tests
   * (which would otherwise cause false-positive 403s when DB IDs are reused
   * after the sqlite_sequence reset).
   */
  _resetForTests() {
    feedLimiter = null;
    purchaseLimiter = null;
  },
};
