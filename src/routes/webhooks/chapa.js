const express = require('express');
const router = express.Router();

const purchaseService = require('../../services/purchaseService');
const { getProvider } = require('../../providers/chapa');
const i18n = require('../../services/localizationService');

/**
 * POST /webhooks/chapa — Chapa payment confirmation webhook (§6.7, §8, answers.md §1).
 *
 * Chapa posts a JSON body with `event: 'charge.success'` and a `data` object
 * containing `tx_ref`, `amount`, `currency`, `status`, and `reference`.
 *
 * The handler:
 *   1. Verifies the Chapa-Signature header (HMAC-SHA256 of the raw body with the
 *      shared webhook secret) — same idempotency/signature-validation treatment
 *      as SEC-007.
 *   2. Parses the payload to extract the purchase id (encoded in tx_ref).
 *   3. Delegates to purchaseService.handleSuccessfulPayment() which marks the
 *      payment + purchase complete and enqueues the post-processing work
 *      (notification + audit) on the payment-webhook-processing queue.
 *
 * Returns 200 OK with empty body for Chapa compliance. Unparseable payloads
 * also return 200 so Chapa doesn't retry — the webhook delivery shouldn't be
 * retried for malformed data.
 */
router.post('/', async (req, res, next) => {
  try {
    const provider = getProvider();

    // SEC-007 equivalent: verify the Chapa webhook signature.
    if (!provider.verifyWebhook(req)) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: i18n.t('INVALID_TOKEN', 'en') },
      });
    }

    const payload = req.body || {};

    // Only charge.success events finalize a purchase.
    if (payload.event !== 'charge.success') {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const result = await purchaseService.handleSuccessfulPayment(payload);
    if (!result.ok) {
      // Still return 200 so Chapa doesn't retry unparseable payloads.
      return res.status(200).json({ ok: true, ignored: true });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
