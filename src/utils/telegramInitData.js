/**
 * Telegram initData verification — SEC-003.
 *
 * Validates the `X-Telegram-Init-Data` (or `tg-init-data`) header on Mini App requests
 * per Telegram's documented HMAC-SHA256 algorithm:
 *
 *   1. Compute the "secret_key" as HMAC-SHA256 of the string "WebAppData" keyed by
 *      the bot token.
 *   2. Extract the `hash` parameter from the initData query string.
 *   3. Build the data-check string by sorting the remaining parameters
 *      alphabetically and joining them as `key=value\n` lines (no trailing newline).
 *   4. Compute HMAC-SHA256 of the data-check string keyed by secret_key.
 *   5. Constant-time compare the computed hash against the extracted `hash`.
 *
 * See: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
const crypto = require('crypto');
const config = require('../config');

/**
 * Parse the initData string (URL-encoded query string) into a key/value map.
 * @param {string} initData  Raw initData from the Telegram WebApp.
 * @returns {{ params: Record<string, string>, hash: string|null }}
 */
function parseInitData(initData) {
  if (!initData || typeof initData !== 'string') {
    return { params: {}, hash: null };
  }
  const params = {};
  let hash = null;
  // Telegram sends initData as a URL-encoded query string.
  for (const pair of initData.split('&')) {
    if (!pair) continue;
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = decodeURIComponent(pair.slice(0, eqIdx));
    const value = decodeURIComponent(pair.slice(eqIdx + 1));
    if (key === 'hash') {
      hash = value;
    } else {
      params[key] = value;
    }
  }
  return { params, hash };
}

/**
 * Validate a Telegram initData string.
 *
 * @param {string} initData   The raw initData string (the value of the
 *                            `tgWebAppData` parameter, or the entire query string
 *                            from the `X-Telegram-Init-Data` header).
 * @param {string} botToken   The bot token. Defaults to config.telegram.botToken.
 * @returns {{ ok: boolean, user?: object, params: Record<string, string> }}
 *          `user` is the parsed `user` JSON payload if present.
 */
function verifyInitData(initData, botToken = config.telegram.botToken) {
  const { params, hash } = parseInitData(initData);
  if (!hash) return { ok: false, params };
  if (!botToken) {
    // No bot token configured — fail closed in prod, but allow tests to pass
    // when explicitly opted out via the TEST_SKIP_INIT_DATA env var.
    if (process.env.NODE_ENV === 'test' && process.env.TEST_SKIP_INIT_DATA === '1') {
      return { ok: true, params, user: tryParseUser(params.user) };
    }
    return { ok: false, params };
  }

  // Step 1: secret_key = HMAC-SHA256("WebAppData", botToken)
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();

  // Step 2: data-check string = sorted key=value lines joined by \n
  const dataCheckString = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('\n');

  // Step 3: computed hash = HMAC-SHA256(dataCheckString, secret_key)
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  // Step 4: constant-time compare
  const ok = crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'));
  if (!ok) return { ok: false, params };

  return { ok: true, params, user: tryParseUser(params.user) };
}

function tryParseUser(userJson) {
  if (!userJson) return undefined;
  try {
    return JSON.parse(userJson);
  } catch {
    return undefined;
  }
}

module.exports = { verifyInitData, parseInitData };
