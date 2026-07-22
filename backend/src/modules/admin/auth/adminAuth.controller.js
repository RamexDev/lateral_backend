// Import admin auth service.
import * as adminAuthService from './adminAuth.service.js';

// Import HTTP response helper.
import { ok } from '../../../lib/http.js';

// Import API error class.
import { ApiError } from '../../../lib/errors.js';

// Import rate-limit helpers.
import {
  recordAdminLoginFailure,
  resetAdminLoginFailures
} from '../../../middleware/rateLimit.js';

// Determine whether a login error should count as a failed attempt.
function shouldCountLoginFailure(err) {
  return (
    err instanceof ApiError &&
    (err.statusCode === 401 || err.statusCode === 403) &&
    err.code !== 'RATE_LIMITED'
  );
}

// Handle admin login.
export async function login(req, res, next) {
  try {
    // Call login service.
    const data = await adminAuthService.login(req.body, {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Reset failed attempts after successful login.
    await resetAdminLoginFailures(req);

    // Return successful auth payload.
    ok(res, data);
  } catch (err) {
    // Record failed login attempt when appropriate.
    if (shouldCountLoginFailure(err)) {
      await recordAdminLoginFailure(req);
    }

    // Forward error to error handler.
    next(err);
  }
}

// Handle refresh token rotation.
export async function refresh(req, res, next) {
  try {
    // Call refresh service.
    const data = await adminAuthService.refresh(req.body, {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Return rotated tokens.
    ok(res, data);
  } catch (err) {
    // Forward error to error handler.
    next(err);
  }
}

// Handle logout.
export async function logout(req, res, next) {
  try {
    // Call logout service.
    const data = await adminAuthService.logout(req.body, {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Return logout success.
    ok(res, data);
  } catch (err) {
    // Forward error to error handler.
    next(err);
  }
}

// Handle current staff profile.
export async function me(req, res, next) {
  try {
    // Use staff ID from authenticated JWT.
    const data = await adminAuthService.getMe(req.staff.id);

    // Return staff profile.
    ok(res, data);
  } catch (err) {
    // Forward error to error handler.
    next(err);
  }
}
