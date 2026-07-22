// Import jsonwebtoken for user access tokens.
import jwt from 'jsonwebtoken';

// Import validated environment variables.
import { env } from '../config/env.js';

// Import logger for startup warnings.
import { logger } from './logger.js';

// Warn when the user JWT secret is still the development default.
if (env.USER_JWT_SECRET === 'dev-user-secret-change-me') {
  logger.warn('USER_JWT_SECRET is using a weak development value');
}

// Sign a user access token.
export function signUserAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      scope: 'user',
      bankId: user.bank_id
    },
    env.USER_JWT_SECRET,
    { expiresIn: env.USER_JWT_EXPIRES_IN }
  );
}

// Verify and decode a user access token.
export function verifyUserAccessToken(token) {
  return jwt.verify(token, env.USER_JWT_SECRET);
}
