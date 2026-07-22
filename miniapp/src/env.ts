// Central environment configuration.
// Reads from import.meta.env (Vite-injected at build time).

// Backend base URL, no trailing slash. Falls back to localhost for dev.
export const env = {
  apiBaseUrl:
    (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, ''),

  // Whether the dev login screen is allowed outside Telegram.
  devLoginEnabled: import.meta.env.VITE_ENABLE_DEV_LOGIN === 'true'
} as const;

// Documented default reveal price. The POST /purchases response is the
// authoritative source once it returns — this is only used as a display
// fallback before the user has interacted with the purchase flow.
export const DEFAULT_REVEAL_PRICE_ETB = 500;
