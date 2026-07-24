// Public config service — exposes non-sensitive runtime configuration.
// Used by the mini app to render the correct reveal price without guessing.

import { env } from '../../config/env.js';

// Get public configuration values.
export async function getPublicConfig() {
  return {
    reveal_price_etb: Number(env.REVEAL_PRICE_ETB) || 500,
    currency: env.CURRENCY || 'ETB',
    payment_provider: env.PAYMENT_PROVIDER || 'chapa',
    photo_base_url: env.PUBLIC_ASSET_BASE_URL || ''
  };
}
