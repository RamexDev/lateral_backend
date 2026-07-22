// Import Node crypto for secure token generation and hashing.
import crypto from 'node:crypto';

// Import jsonwebtoken for staff access tokens.
import jwt from 'jsonwebtoken';

// Import validated environment variables.
import { env } from '../config/env.js';

// Import logger for startup warnings.
import { logger } from './logger.js';

// Parse a duration string like 15m or 7d into milliseconds.
function parseDurationToMs(value) {
  // Supported unit multipliers.
  const units = {
    ms: 1,
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000,
    w: 604800000,
    y: 31536000000
  };

  // Normalize input text.
  const text = String(value).trim();

  // Unit suffixes ordered to check ms before s and m.
  const unitKeys = ['ms', 's', 'm', 'h', 'd', 'w', 'y'];

  // Store detected unit and numeric part.
  let unit = null;
  let numberPart = text;

  // Find the matching suffix.
  for (const key of unitKeys) {
    if (text.endsWith(key)) {
      unit = key;
      numberPart = text.slice(0, -key.length);
      break;
    }
  }

  // Parse numeric part.
  const amount = Number(numberPart);

  // Reject invalid durations.
  if (!unit || Number.isNaN(amount) || amount <= 0) {
    throw new Error('Invalid duration value: ' + value);
  }

  // Return milliseconds.
  return amount * units[unit];
}

// Warn when the admin access token secret is still the development default.
if (env.ADMIN_ACCESS_TOKEN_SECRET === 'dev-admin-secret-change-me') {
  logger.warn('ADMIN_ACCESS_TOKEN_SECRET is using a weak development value');
}

// Parse refresh token TTL once at startup.
const refreshTokenTtlMs = parseDurationToMs(env.ADMIN_REFRESH_TOKEN_EXPIRES_IN);

// Hash a value with SHA-256 and return hex.
export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// Generate an opaque rotating refresh token.
export function generateRefreshToken() {
  return 'v1.' + crypto.randomBytes(48).toString('hex');
}

// Sign a short-lived staff access token.
export function signStaffAccessToken(staff) {
  return jwt.sign(
    {
      sub: staff.id,
      scope: 'staff',
      role: staff.role,
      lang: staff.preferred_language
    },
    env.ADMIN_ACCESS_TOKEN_SECRET,
    { expiresIn: env.ADMIN_ACCESS_TOKEN_EXPIRES_IN }
  );
}

// Verify and decode a staff access token.
export function verifyStaffAccessToken(token) {
  return jwt.verify(token, env.ADMIN_ACCESS_TOKEN_SECRET);
}

// Return the expiry Date for a new refresh token.
export function getRefreshTokenExpiresAt() {
  return new Date(Date.now() + refreshTokenTtlMs);
}
