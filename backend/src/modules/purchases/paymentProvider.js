// Provider-agnostic payment interface.
// ChapaProvider is the active implementation.
// TelebirrProvider is adapter-ready for future integration.
// Both implement: createCheckout(payment) → { checkout_url, tx_ref }

// Import env config.
import { env } from '../../config/env.js';
// Import logger.
import { logger } from '../../lib/logger.js';

// Chapa payment provider implementation.
class ChapaProvider {
  constructor() {
    // Chapa API base URL.
    this.baseUrl = env.CHAPA_BASE_URL || 'https://api.chapa.co/v1';
    // Chapa secret key.
    this.secretKey = env.CHAPA_SECRET_KEY || '';
  }

  // Create a checkout session for a payment.
  async createCheckout({ txRef, amount, currency, email, firstName, lastName, title }) {
    // In test/dev mode without a real Chapa key, return a mock checkout URL.
    if (!this.secretKey || this.secretKey === 'test' || env.NODE_ENV === 'test') {
      logger.info({ txRef }, 'Chapa mock checkout (no secret key configured)');
      return {
        checkout_url: 'https://checkout.chapa.co/mock/' + txRef,
        tx_ref: txRef
      };
    }

    // Call Chapa initialize transaction API.
    const response = await fetch(this.baseUrl + '/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + this.secretKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: String(amount),
        currency: currency || 'ETB',
        email: email || 'user@zwuwur.app',
        first_name: firstName || 'Zwuwur',
        last_name: lastName || 'User',
        title: title || 'Contact Reveal',
        callback_url: env.APP_BASE_URL + '/api/v1/webhooks/chapa',
        return_url: env.MINI_APP_BASE_URL + '/marketplace?purchase=success',
        customization: {
          title: 'Zwuwur Contact Reveal',
          description: 'Unlock full contact details for this candidate.'
        }
      })
    });

    // Parse response.
    const data = await response.json();

    // Check for Chapa API errors.
    if (data.status !== 'success') {
      logger.error({ data, txRef }, 'Chapa checkout creation failed');
      throw new Error('Payment provider error: ' + (data.message || 'Unknown error'));
    }

    return {
      checkout_url: data.data.checkout_url,
      tx_ref: txRef
    };
  }

  // Verify a webhook signature using HMAC-SHA256.
  verifySignature(rawBody, signature) {
    // Compute expected HMAC.
    const expected = crypto
      .createHmac('sha256', this.secretKey)
      .update(rawBody)
      .digest('hex');
    // Constant-time comparison.
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    );
  }
}

// Telebirr payment provider (adapter-ready, not yet implemented).
class TelebirrProvider {
  async createCheckout() {
    throw new Error('Telebirr provider not yet implemented.');
  }
  verifySignature() {
    throw new Error('Telebirr provider not yet implemented.');
  }
}

// Export the active provider based on configuration.
const activeProviderName = env.PAYMENT_PROVIDER || 'chapa';

// Provider registry.
const providers = {
  chapa: new ChapaProvider(),
  telebirr: new TelebirrProvider()
};

// Export the active provider instance.
export const paymentProvider = providers[activeProviderName] || providers.chapa;

// Export provider classes for testing.
export { ChapaProvider, TelebirrProvider };
