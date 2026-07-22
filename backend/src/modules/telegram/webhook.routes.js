// Import Express router.
import { Router } from 'express';

// Import Node crypto for timing-safe comparison.
import crypto from 'node:crypto';

// Import environment variables.
import { env } from '../../config/env.js';

// Import API error class.
import { ApiError } from '../../lib/errors.js';

// Import webhook controller.
import * as webhookController from './webhook.controller.js';

// Create Telegram webhook router.
const router = Router();

// Compare provided secret with expected secret safely.
function safeEqual(provided, expected) {
  const providedBuffer = Buffer.from(String(provided));
  const expectedBuffer = Buffer.from(String(expected));

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

// Verify Telegram webhook secret token.
router.use((req, res, next) => {
  // Telegram sends this header when the webhook is configured with a secret token.
  const provided = req.headers['x-telegram-bot-api-secret-token'];

  // Reject missing or invalid secret.
  if (!provided || !safeEqual(provided, env.TELEGRAM_WEBHOOK_SECRET)) {
    return next(new ApiError(401, 'INVALID_SIGNATURE', 'Webhook secret invalid.'));
  }

  // Continue to webhook handler.
  next();
});

// POST /api/v1/telegram/webhook
router.post('/', webhookController.handleUpdate);

// Export Telegram webhook router.
export default router;
