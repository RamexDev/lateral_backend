/**
 * PaymentService — provider-agnostic interface (§8) with a stub TelegramStarsProvider.
 *
 * createInvoice(purchase) returns a provider invoice link for the bot/Mini App to present.
 * verifyWebhook(req) authenticates the incoming webhook (secret token in prod).
 * parseSuccessfulPayment(payload) extracts the canonical charge id + amount + currency
 *   + invoice payload (which encodes the purchase id).
 *
 * In tests we don't actually call Telegram — the stub returns a deterministic link
 * and verifyWebhook is bypassed (the webhook route is invoked directly).
 */
const config = require('../config');

class PaymentProvider {
  async createInvoice(/* purchase */) {
    throw new Error('Not implemented');
  }
  verifyWebhook(/* req */) {
    throw new Error('Not implemented');
  }
  parseSuccessfulPayment(/* payload */) {
    throw new Error('Not implemented');
  }
}

class TelegramStarsProvider extends PaymentProvider {
  constructor() {
    super();
    this.name = 'telegram_stars';
  }

  /**
   * Returns a fake-but-stable invoice URL. In production this calls
   * Telegram Bot API's sendInvoice/createInvoiceLink endpoint.
   */
  async createInvoice({ purchaseId, amountEtb, currency }) {
    const token = config.telegram.paymentsProviderToken || 'stars';
    return `https://t.me/invoice/${token}_${purchaseId}_${amountEtb}_${currency}`;
  }

  /**
   * Validates the X-Telegram-Bot-Api-Secret-Token header (SEC-007).
   * Reads the secret fresh from env on each call so tests can toggle it without
   * needing to bust the module cache. An empty/undefined secret means "no
   * validation required" (the test default — webhook is invoked directly).
   */
  verifyWebhook(req) {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET || config.telegram.webhookSecret || '';
    if (!secret) return true;
    const header = req.headers['x-telegram-bot-api-secret-token'];
    return header === secret;
  }

  parseSuccessfulPayment(payload) {
    const successful = payload?.message?.successful_payment;
    if (!successful) return null;
    const invoicePayload = successful.invoice_payload || '';
    // Format: "purchase:<purchaseId>"
    const match = invoicePayload.match(/^purchase:(\d+)$/);
    return {
      chargeId: successful.telegram_payment_charge_id,
      totalAmount: successful.total_amount,
      currency: successful.currency,
      purchaseId: match ? Number(match[1]) : null,
      rawPayload: successful,
    };
  }
}

const instance = new TelegramStarsProvider();

module.exports = {
  PaymentProvider,
  TelegramStarsProvider,
  getProvider: () => instance,
};
