/**
 * PaymentProvider interface + Chapa implementation (§8, answers.md §1).
 *
 * Chapa flow (off-platform checkout):
 *   1. createInvoice() calls Chapa's /transaction/initialize endpoint with the
 *      purchase id encoded in `tx_ref`. Returns Chapa's `checkout_url` for the
 *      bot/Mini App to deep-link the user out to.
 *   2. The user completes payment on Chapa's hosted page.
 *   3. Chapa hits POST /api/v1/webhooks/chapa with the result; verifyWebhook()
 *      authenticates the request (HMAC-SHA256 of the body with the shared
 *      webhook secret).
 *   4. parseSuccessfulPayment() extracts the canonical `tx_ref` (our charge id),
 *      amount, currency, and the raw payload for storage.
 *
 * In tests we don't actually call Chapa — createInvoice returns a deterministic
 * fake checkout URL, and verifyWebhook is bypassed when no secret is set.
 */
const crypto = require('crypto');
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

class ChapaProvider extends PaymentProvider {
  constructor() {
    super();
    this.name = 'chapa';
  }

  /**
   * Returns a Chapa checkout URL. In production this calls Chapa's
   * /transaction/initialize endpoint with the secret key in the Authorization
   * header. The `tx_ref` field carries the purchase id so the webhook can
   * route the confirmation back to the right purchase.
   *
   * In tests (no secret key configured) it returns a deterministic fake URL
   * so the purchase flow can be exercised end-to-end without an HTTP call.
   */
  async createInvoice({ purchaseId, amountEtb, currency, buyerEmail, buyerName }) {
    const txRef = `purchase:${purchaseId}`;
    const secretKey = config.chapa.secretKey;

    // Test/dev stub — no real HTTP call.
    if (!secretKey || config.isTest) {
      return `https://checkout.chapa.co/test/${txRef}_${amountEtb}_${currency}`;
    }

    // Production call to Chapa's /transaction/initialize.
    const https = require('https');
    const { URL } = require('url');
    const endpoint = new URL('/transaction/initialize', config.chapa.apiBase);

    const body = JSON.stringify({
      amount: String(amountEtb),
      currency,
      tx_ref: txRef,
      // Chapa requires these — the bot/Mini App provides them on the client
      // before the purchase call. In tests we use placeholders.
      email: buyerEmail || 'buyer@lateral.local',
      first_name: buyerName || 'Buyer',
      // Chapa redirects here after the user completes payment on their hosted page.
      callback_url: `${config.cors.miniappOrigin}/payments/callback`,
      return_url: `${config.cors.miniappOrigin}/payments/return`,
      customization: { title: 'Lateral Transfer Reveal' },
    });

    return new Promise((resolve, reject) => {
      const req = https.request(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${secretKey}`,
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => (raw += chunk));
          res.on('end', () => {
            try {
              const json = JSON.parse(raw);
              if (res.statusCode >= 200 && res.statusCode < 300 && json?.data?.checkout_url) {
                resolve(json.data.checkout_url);
              } else {
                reject(new Error(`Chapa initialize failed (${res.statusCode}): ${raw}`));
              }
            } catch (err) {
              reject(new Error(`Chapa response parse error: ${err.message}`));
            }
          });
        },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  /**
   * Verifies the Chapa webhook signature (SEC-007 equivalent for Chapa).
   *
   * Chapa signs webhooks with HMAC-SHA256 of the raw body using the shared
   * webhook secret. We read the secret fresh from env on each call so tests
   * can toggle it without busting the module cache. An empty/undefined secret
   * means "no validation required" (the test default — webhook is invoked
   * directly).
   */
  verifyWebhook(req) {
    const secret = process.env.CHAPA_WEBHOOK_SECRET || config.chapa.webhookSecret || '';
    if (!secret) return true;
    const signature = req.headers['chapa-signature'];
    if (!signature) return false;
    const rawBody =
      typeof req.rawBody === 'string'
        ? req.rawBody
        : JSON.stringify(req.body || {});
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    // Timing-safe comparison to avoid signature oracle.
    if (signature.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  /**
   * Parses the Chapa webhook payload into a canonical shape.
   *
   * Chapa webhook body (successful payment) looks like:
   *   {
   *     "event": "charge.success",
   *     "data": {
   *       "tx_ref": "purchase:42",
   *       "amount": "500",
   *       "currency": "ETB",
   *       "status": "success",
   *       "reference": "chapa-ref-...",
   *       ...
   *     }
   *   }
   *
   * We use `tx_ref` as the canonical charge id (it carries our purchase id),
   * and store the entire `data` object in `payments.raw_payload`.
   */
  parseSuccessfulPayment(payload) {
    const data = payload?.data || payload;
    if (!data || data.status !== 'success') return null;
    const txRef = data.tx_ref || '';
    const match = txRef.match(/^purchase:(\d+)$/);
    if (!match) return null;
    return {
      chargeId: txRef,
      totalAmount: Number(data.amount),
      currency: data.currency,
      purchaseId: match ? Number(match[1]) : null,
      rawPayload: data,
    };
  }
}

const instance = new ChapaProvider();

module.exports = {
  PaymentProvider,
  ChapaProvider,
  getProvider: () => instance,
};
