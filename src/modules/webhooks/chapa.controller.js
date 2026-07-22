// Import purchases service.
import { handleChapaWebhook } from '../purchases/purchases.service.js';
// Import HTTP response helper.
import { ok } from '../../lib/http.js';
// Import logger.
import { logger } from '../../lib/logger.js';

// Handle POST /api/v1/webhooks/chapa
export async function chapaWebhook(req, res, next) {
  try {
    // Extract webhook payload.
    const payload = req.body;

    // Log incoming webhook.
    logger.info({ tx_ref: payload.tx_ref, status: payload.status }, 'Chapa webhook received.');

    // Process webhook.
    const result = await handleChapaWebhook(payload);

    // Return success response.
    ok(res, result, 'Webhook processed.');
  } catch (err) {
    next(err);
  }
}
