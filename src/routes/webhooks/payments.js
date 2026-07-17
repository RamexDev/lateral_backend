const express = require('express');
const router = express.Router();

const purchaseService = require('../../services/purchaseService');
const { getProvider } = require('../../providers/telegramStars');
const i18n = require('../../services/localizationService');

/**
 * POST /webhooks/telegram/payments — handles pre_checkout_query + successful_payment (§6.7).
 *
 * pre_checkout_query must be answered within Telegram's timeout window.
 * successful_payment is processed idempotently keyed on telegram_payment_charge_id (FR-PAY-002).
 *
 * Returns 200 OK with empty body for Telegram compliance.
 */
router.post('/', async (req, res, next) => {
  try {
    // SEC-007: verify the Telegram webhook secret token (no-op in tests).
    const provider = getProvider();
    if (!provider.verifyWebhook(req)) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: i18n.t('INVALID_TOKEN', 'en') },
      });
    }

    // pre_checkout_query — answer within Telegram's timeout.
    if (req.body?.pre_checkout_query) {
      // In production, call Telegram's answerPreCheckoutQuery API.
      // Here we just ack with 200 OK.
      return res.status(200).json({ ok: true });
    }

    // successful_payment — finalize the purchase.
    if (req.body?.message?.successful_payment) {
      const result = await purchaseService.handleSuccessfulPayment(req.body);
      if (!result.ok) {
        // Still return 200 to Telegram — webhook delivery shouldn't be retried for unparseable payloads.
        return res.status(200).json({ ok: true, ignored: true });
      }
      return res.status(200).json({ ok: true });
    }

    // Unknown payload — ack so Telegram doesn't retry.
    return res.status(200).json({ ok: true, ignored: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
