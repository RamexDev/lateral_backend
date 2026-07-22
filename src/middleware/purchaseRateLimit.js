// Import Redis client.
import { redis } from '../lib/redis.js';
// Import API error class.
import { ApiError } from '../lib/errors.js';
// Import logger.
import { logger } from '../lib/logger.js';

// Purchase rate limit: 10 requests per minute per user.
const PURCHASE_MAX_REQUESTS = 10;
const PURCHASE_WINDOW_SECONDS = 60;

// Purchase rate limit middleware.
export async function purchaseRateLimit(req, res, next) {
  try {
    const userId = req.user ? req.user.id : 'anonymous';
    const key = 'rl:purchase:' + userId;

    // Increment request count.
    const current = await redis.incr(key);
    // Set expiry on first request.
    if (current === 1) {
      await redis.expire(key, PURCHASE_WINDOW_SECONDS);
    }
    // Reject when limit exceeded.
    if (current > PURCHASE_MAX_REQUESTS) {
      const ttl = await redis.ttl(key);
      const retryAfter = ttl > 0 ? ttl : PURCHASE_WINDOW_SECONDS;
      throw new ApiError(
        429,
        'RATE_LIMITED',
        'Too many purchase attempts. Try again in ' + retryAfter + ' seconds.'
      );
    }
    next();
  } catch (err) {
    // Re-throw API errors.
    if (err instanceof ApiError) {
      return next(err);
    }
    // Log Redis failure but fail open for availability.
    logger.error({ err }, 'Purchase rate limiter failed');
    next();
  }
}
