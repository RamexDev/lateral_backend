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
    adminSessionTtlMinutes: Number(process.env.ADMIN_SESSION_TTL_MINUTES || 30),
  },

  cors: {
    miniappOrigin: process.env.MINIAPP_ORIGIN || '*',
    adminPwaOrigin: process.env.ADMIN_PWA_ORIGIN || '*',
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
    paymentsProviderToken: process.env.TELEGRAM_PAYMENTS_PROVIDER_TOKEN || '',
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
