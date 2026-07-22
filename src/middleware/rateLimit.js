// Import Redis client.
import { redis } from '../lib/redis.js';

// Import API error class.
import { ApiError } from '../lib/errors.js';

// Import logger.
import { logger } from '../lib/logger.js';

// Maximum failed admin login attempts before lockout.
const ADMIN_LOGIN_MAX_ATTEMPTS = 5;

// Lockout window in seconds: 15 minutes.
const ADMIN_LOGIN_WINDOW_SECONDS = 15 * 60;

// Build Redis rate-limit key for admin login.
function getLoginKey(req) {
  // Use request IP, falling back to socket address or unknown.
  const ip = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';

  // Return namespaced Redis key.
  return 'rl:admin-login:' + ip;
}

// Middleware that blocks login attempts after too many failures.
export async function adminLoginRateLimit(req, res, next) {
  // Store rate-limit key on request for later success/failure updates.
  const key = getLoginKey(req);
  req.adminLoginRateLimitKey = key;

  try {
    // Read current failed attempt count.
    const current = await redis.get(key);

    // Block when limit reached.
    if (current !== null && Number(current) >= ADMIN_LOGIN_MAX_ATTEMPTS) {
      // Read remaining TTL.
      const ttl = await redis.ttl(key);

      // Choose safe retry-after value.
      const retryAfter = ttl > 0 ? ttl : ADMIN_LOGIN_WINDOW_SECONDS;

      // Set standard Retry-After header.
      res.set('Retry-After', String(retryAfter));

      // Return rate-limit error.
      return next(
        new ApiError(
          403,
          'RATE_LIMITED',
          'Too many failed login attempts. Try again in ' + retryAfter + ' seconds.'
        )
      );
    }

    // Allow login attempt.
    return next();
  } catch (err) {
    // Log Redis failure.
    logger.error({ err }, 'Admin login rate limiter failed');

    // Fail open for availability but log loudly.
    // In production, monitor this closely.
    return next();
  }
}

// Record a failed admin login attempt.
export async function recordAdminLoginFailure(req) {
  try {
    // Use stored key or rebuild it.
    const key = req.adminLoginRateLimitKey || getLoginKey(req);

    // Increment failure count.
    const attempts = await redis.incr(key);

    // Set expiry on first failure.
    if (attempts === 1) {
      await redis.expire(key, ADMIN_LOGIN_WINDOW_SECONDS);
    }

    // If key somehow has no TTL, set it.
    const ttl = await redis.ttl(key);
    if (ttl < 0) {
      await redis.expire(key, ADMIN_LOGIN_WINDOW_SECONDS);
    }
  } catch (err) {
    // Log but do not block auth response.
    logger.error({ err }, 'Failed to record admin login failure');
  }
}

// Reset failed admin login attempts after successful login.
export async function resetAdminLoginFailures(req) {
  try {
    // Use stored key or rebuild it.
    const key = req.adminLoginRateLimitKey || getLoginKey(req);

    // Delete failure counter.
    await redis.del(key);
  } catch (err) {
    // Log but do not block auth response.
    logger.error({ err }, 'Failed to reset admin login failures');
  }
}
