/**
 * Centralized config — reads and validates environment variables.
 * Single source of truth for runtime configuration across the app.
 */

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

const isTest = process.env.NODE_ENV === 'test';
const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  env: process.env.NODE_ENV || 'development',
  isTest,
  isProd,
  port: Number(process.env.PORT || 3000),

  db: {
    client: isTest ? 'better-sqlite3' : 'mysql2',
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    name: process.env.DB_NAME || 'lateral_transfer',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    poolMin: Number(process.env.DB_POOL_MIN || 2),
    poolMax: Number(process.env.DB_POOL_MAX || 20),
  },

  redis: {
    url: process.env.REDIS_URL || '',
  },

  jwt: {
    secret: isTest ? 'test-jwt-secret' : required('JWT_SECRET', 'dev-jwt-secret-change-me'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    adminExpiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '30m',
    adminRefreshExpiresIn: process.env.ADMIN_REFRESH_TOKEN_EXPIRES_IN || '7d',
    adminSessionTtlMinutes: Number(process.env.ADMIN_SESSION_TTL_MINUTES || 30),
    adminIdleTimeoutMinutes: Number(process.env.ADMIN_IDLE_TIMEOUT_MINUTES || 10),
  },

  cors: {
    miniappOrigin: process.env.MINIAPP_ORIGIN || '*',
    adminPwaOrigin: process.env.ADMIN_PWA_ORIGIN || '*',
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
  },

  // Chapa — off-platform checkout provider (replaces Telegram Stars as of answers.md §1).
  // The bot/Mini App deep-links the user out to Chapa's hosted checkout page; Chapa's
  // webhook confirms payment back to our /api/v1/webhooks/chapa endpoint.
  chapa: {
    apiBase:
      process.env.CHAPA_API_BASE || 'https://api.chapa.co/v1',
    secretKey: process.env.CHAPA_SECRET_KEY || '',
    publicKey: process.env.CHAPA_PUBLIC_KEY || '',
    webhookSecret: process.env.CHAPA_WEBHOOK_SECRET || '',
  },

  payments: {
    amountEtb: Number(process.env.PAYMENT_AMOUNT_ETB || 500),
    currency: process.env.PAYMENT_CURRENCY || 'ETB',
  },

  business: {
    defaultGradeAdjacencyRange: Number(process.env.DEFAULT_GRADE_ADJACENCY_RANGE || 1),
    digestScheduleCron: process.env.DIGEST_SCHEDULE_CRON || '0 6 * * *',
    botSessionTtlHours: Number(process.env.BOT_SESSION_TTL_HOURS || 24),
  },
};
