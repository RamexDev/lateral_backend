// Import staff access token verifier.
import { verifyStaffAccessToken } from '../lib/adminTokens.js';

// Import API error class.
import { ApiError } from '../lib/errors.js';

// Extract bearer token from Authorization header.
function getBearerToken(req) {
  // Read header.
  const header = req.headers.authorization || '';

  // Require Bearer scheme.
  if (!header.startsWith('Bearer ')) {
    return null;
  }

  // Return token without prefix.
  return header.slice(7).trim();
}

// Authenticate admin/staff access tokens.
export function authenticateStaff(req, res, next) {
  // Extract bearer token.
  const token = getBearerToken(req);

  // Reject missing token.
  if (!token) {
    return next(new ApiError(401, 'INVALID_TOKEN', 'Missing bearer token.'));
  }

  // Verify JWT.
  let payload;
  try {
    payload = verifyStaffAccessToken(token);
  } catch {
    return next(new ApiError(401, 'INVALID_TOKEN', 'Invalid or expired token.'));
  }

  // Reject non-staff tokens on admin routes.
  if (payload.scope !== 'staff') {
    return next(new ApiError(403, 'SCOPE_FORBIDDEN', 'Token scope not permitted for this route.'));
  }

  // Attach decoded auth payload.
  req.auth = payload;

  // Attach convenient staff context.
  req.staff = {
    id: payload.sub,
    role: payload.role,
    language: payload.lang
  };

  // Continue.
  next();
}

// Require one or more staff roles.
export function requireRole(...allowedRoles) {
  // Return Express middleware.
  return (req, res, next) => {
    // Ensure staff authentication has run.
    if (!req.staff) {
      return next(new ApiError(401, 'INVALID_TOKEN', 'Authentication required.'));
    }

    // Ensure staff role is allowed.
    if (!allowedRoles.includes(req.staff.role)) {
      return next(new ApiError(403, 'INSUFFICIENT_ROLE', 'Staff role not permitted for this route.'));
    }

    // Continue.
    next();
  };
}
