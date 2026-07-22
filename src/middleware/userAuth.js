// Import user token verifier.
import { verifyUserAccessToken } from '../lib/userTokens.js';

// Import MySQL pool.
import { pool } from '../db/pool.js';

// Import API error class.
import { ApiError } from '../lib/errors.js';

// Authenticate user JWTs on /api/v1 routes.
export async function authenticateUser(req, res, next) {
  try {
    // Read Authorization header.
    const header = req.headers.authorization || '';

    // Require Bearer scheme.
    if (!header.startsWith('Bearer ')) {
      return next(new ApiError(401, 'INVALID_TOKEN', 'Missing bearer token.'));
    }

    // Extract token.
    const token = header.slice(7).trim();

    // Verify JWT.
    let payload;
    try {
      payload = verifyUserAccessToken(token);
    } catch {
      return next(new ApiError(401, 'INVALID_TOKEN', 'Invalid or expired token.'));
    }

    // Reject non-user tokens on user routes.
    if (payload.scope !== 'user') {
      return next(new ApiError(403, 'SCOPE_FORBIDDEN', 'Token scope not permitted for this route.'));
    }

    // Load minimal user record.
    const [rows] = await pool.query(
      'SELECT id, bank_id, preferred_language, is_active FROM users WHERE id = ?',
      [payload.sub]
    );

    const user = rows[0];

    // Reject unknown users.
    if (!user) {
      return next(new ApiError(401, 'INVALID_TOKEN', 'User not found.'));
    }

    // Reject disabled users.
    if (!user.is_active) {
      return next(new ApiError(403, 'ACCOUNT_DISABLED', 'Account is disabled.'));
    }

    // Attach user context to request.
    req.user = {
      id: user.id,
      bankId: user.bank_id,
      language: user.preferred_language
    };

    // Continue.
    next();
  } catch (err) {
    next(err);
  }
}
