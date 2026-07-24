// Environment configuration.
// Vite only exposes env vars prefixed with VITE_.

export const env = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  devLoginEnabled: import.meta.env.VITE_ENABLE_DEV_LOGIN === 'true'
} as const;

// Default reveal price fallback — used only before /config is fetched.
// Once the app boots, useConfig() loads the authoritative value from /api/v1/config.
export const DEFAULT_REVEAL_PRICE_ETB = 500;
export const DEFAULT_CURRENCY = 'ETB';
