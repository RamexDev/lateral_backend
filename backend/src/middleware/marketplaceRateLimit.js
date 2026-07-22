// Import Redis client.
import { redis } from '../lib/redis.js';
// Import API error class.
import { ApiError } from '../lib/errors.js';
// Import logger.
import { logger } from '../lib/logger.js';

// Feed rate limit: 60 requests per minute per user.
const FEED_MAX_REQUESTS = 60;
const FEED_WINDOW_SECONDS = 60;

// People rate limit: 60 requests per minute per user.
const PEOPLE_MAX_REQUESTS = 60;
const PEOPLE_WINDOW_SECONDS = 60;

// Generic sliding-window rate limiter using Redis.
async function checkRateLimit(key, maxRequests, windowSeconds) {
  try {
    // Increment request count.
    const current = await redis.incr(key);
    // Set expiry on first request.
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }
    // Reject when limit exceeded.
    if (current > maxRequests) {
      const ttl = await redis.ttl(key);
      const retryAfter = ttl > 0 ? ttl : windowSeconds;
      throw new ApiError(
        429,
        'RATE_LIMITED',
        'Too many requests. Try again in ' + retryAfter + ' seconds.'
      );
    }
  } catch (err) {
    // Re-throw API errors.
    if (err instanceof ApiError) {
      throw err;
    }
    // Log Redis failure but fail open for availability.
    logger.error({ err }, 'Marketplace rate limiter failed');
  }
}

// Feed rate limit middleware.
export async function userFeedRateLimit(req, res, next) {
  try {
    const userId = req.user ? req.user.id : 'anonymous';
    const key = 'rl:user-feed:' + userId;
    await checkRateLimit(key, FEED_MAX_REQUESTS, FEED_WINDOW_SECONDS);
    next();
  } catch (err) {
    next(err);
  }
}

// People rate limit middleware.
export async function userPeopleRateLimit(req, res, next) {
  try {
    const userId = req.user ? req.user.id : 'anonymous';
    const key = 'rl:user-people:' + userId;
    await checkRateLimit(key, PEOPLE_MAX_REQUESTS, PEOPLE_WINDOW_SECONDS);
    next();
  } catch (err) {
    next(err);
  }
}
