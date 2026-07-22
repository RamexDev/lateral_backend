// Import Node crypto for HMAC verification.
import crypto from 'node:crypto';

// Import validated environment variables.
import { env } from '../config/env.js';

// Import API error class.
import { ApiError } from './errors.js';

// Maximum allowed initData age: 24 hours.
const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;

// Compare two strings in constant time.
function safeEqual(a, b) {
  const aBuffer = Buffer.from(String(a));
  const bBuffer = Buffer.from(String(b));

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

// Verify Telegram Mini App initData and return the Telegram user object.
export function verifyTelegramInitData(initData) {
  try {
    // Parse initData query string.
    const params = new URLSearchParams(initData);

    // Extract and remove hash.
    const hash = params.get('hash');
    if (!hash) {
      throw new Error('Missing hash');
    }

    params.delete('hash');

    // Sort remaining key/value pairs lexicographically by key.
    const entries = Array.from(params.entries()).sort((a, b) => {
      if (a[0] === b[0]) {
        return 0;
      }
      return a[0] < b[0] ? -1 : 1;
    });

    // Build the data check string.
    const dataCheckString = entries
      .map((entry) => entry[0] + '=' + entry[1])
      .join('\n');

    // Derive the secret key using the Telegram WebApp algorithm.
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(env.TELEGRAM_BOT_TOKEN)
      .digest();

    // Calculate the expected hash.
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Reject invalid signature.
    if (!safeEqual(calculatedHash, hash)) {
      throw new Error('Invalid initData hash');
    }

    // Reject stale or future auth_date values.
    const authDate = Number(params.get('auth_date'));
    const now = Math.floor(Date.now() / 1000);

    if (!authDate || now - authDate > MAX_AUTH_AGE_SECONDS || authDate - now > 60) {
      throw new Error('Stale initData');
    }

    // Parse the embedded user object.
    const userRaw = params.get('user');
    if (!userRaw) {
      throw new Error('Missing user payload');
    }

    const user = JSON.parse(userRaw);

    if (!user || !user.id) {
      throw new Error('Missing Telegram user id');
    }

    return user;
  } catch {
    // Return a standardized authentication error.
    throw new ApiError(401, 'INVALID_TOKEN', 'Telegram initData verification failed.');
  }
}
