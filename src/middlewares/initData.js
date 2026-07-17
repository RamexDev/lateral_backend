/**
 * initData middleware — SEC-003.
 *
 * Validates the `X-Telegram-Init-Data` header on Mini App requests per Telegram's
 * HMAC-SHA256 algorithm (see utils/telegramInitData.js).
 *
 * Behavior:
 *   - If the header is absent, the request is allowed through (treated as a
 *     trusted bot-gateway internal call). The bot gateway is server-side and
 *     authenticates via the Telegram webhook secret token (SEC-007) instead.
 *   - If the header is present, the initData is verified. On success, the parsed
 *     `user.id` from initData overrides `req.body.telegramId` so a Mini App
 *     cannot impersonate another user. On failure, returns 401 INVALID_INIT_DATA.
 *
 * This is "soft enforcement" — strict mode would require either:
 *   (a) every onboarding call to come through the bot gateway (server-side), OR
 *   (b) every Mini App call to include initData (no fallback).
 * v1 keeps the bot-gateway fallback so tests and the existing flow don't break,
 * but Mini App traffic is now protected against impersonation.
 */
const { verifyInitData } = require('../utils/telegramInitData');
const { ApiError } = require('../utils/ApiError');
const i18n = require('../services/localizationService');

function requireInitData() {
  return (req, res, next) => {
    const header =
      req.headers['x-telegram-init-data'] || req.headers['tg-init-data'] || null;
    if (!header) {
      // No header — trusted internal call (bot gateway).
      return next();
    }

    const result = verifyInitData(header);
    if (!result.ok) {
      return next(
        ApiError.unauthorized('INVALID_INIT_DATA', i18n.t('INVALID_INIT_DATA', 'en')),
      );
    }

    // Override telegramId from initData's user payload so a Mini App cannot
    // impersonate another user.
    if (result.user?.id && req.body && req.body.telegramId !== undefined) {
      req.body.telegramId = result.user.id;
    }
    if (result.user?.username && req.body && req.body.telegramUsername !== undefined) {
      req.body.telegramUsername = result.user.username;
    }

    next();
  };
}

module.exports = { requireInitData };
