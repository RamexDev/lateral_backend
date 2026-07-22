// Import Zod for environment validation.
import { z } from 'zod';

// Load .env into process.env.
import 'dotenv/config';

// Create a boolean parser that defaults to false.
const bool = z.enum(['true', 'false']).default('false').transform((value) => value === 'true');

// Create a boolean parser that defaults to true.
const boolTrue = z.enum(['true', 'false']).default('true').transform((value) => value === 'true');

// Define the environment schema.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  BASE_URL: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.string().default('info'),
  CORS_ORIGIN: z.string().default('*'),

  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().default('zwuwur'),
  DB_PASSWORD: z.string().default('changeme'),
  DB_NAME: z.string().default('zwuwur'),
  DB_CONNECTION_LIMIT: z.coerce.number().default(10),

  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),

  USER_JWT_SECRET: z.string().default('dev-user-secret-change-me'),
  USER_JWT_EXPIRES_IN: z.string().default('30d'),

  ADMIN_ACCESS_TOKEN_SECRET: z.string().default('dev-admin-secret-change-me'),
  ADMIN_ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
  ADMIN_REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),

  TELEGRAM_BOT_TOKEN: z.string().default('dev-telegram-token'),
  TELEGRAM_WEBHOOK_SECRET: z.string().default('dev-telegram-webhook-secret'),
  MINI_APP_URL: z.string().default('https://t.me/zwuwur_bot/app'),

  PAYMENT_PROVIDER: z.enum(['chapa', 'telebirr']).default('chapa'),
  CHAPA_SECRET_KEY: z.string().default('dev-chapa-secret'),
  CHAPA_WEBHOOK_SECRET: z.string().default('dev-chapa-webhook-secret'),
  CHAPA_BASE_URL: z.string().default('https://api.chapa.co/v1'),
  TELEBIRR_APP_ID: z.string().default('dev-telebirr-app-id'),
  TELEBIRR_APP_KEY: z.string().default('dev-telebirr-app-key'),
  TELEBIRR_WEBHOOK_SECRET: z.string().default('dev-telebirr-webhook-secret'),
  TELEBIRR_BASE_URL: z.string().default('https://app.telebirr.com'),
  CURRENCY: z.string().default('ETB'),
  REVEAL_PRICE_ETB: z.coerce.number().default(500),

  DIGEST_CRON: z.string().default('0 6 * * *'),
  DIGEST_TIMEZONE: z.string().default('Africa/Addis_Ababa'),

  SUPER_ADMIN_EMAIL: z.string().default('admin@zwuwur.app'),
  SUPER_ADMIN_PASSWORD: z.string().default('ChangeMe123!'),
  SUPER_ADMIN_FULL_NAME: z.string().default('Root Admin'),

  AVATAR_STORAGE_DIR: z.string().default('./storage/avatars'),
  MAX_UPLOAD_MB: z.coerce.number().default(5),
  PUBLIC_ASSET_BASE_URL: z.string().default('http://localhost:3000'),

  SEED_USE_ENGLISH_AS_AMHARIC_PLACEHOLDER: boolTrue,
  SEED_FINFINNE_SURROUNDING_ACTIVE: bool,
  REQUIRE_AMHARIC_REVIEW: bool
});

// Parse environment variables.
const parsed = schema.safeParse(process.env);

// Stop startup when environment variables are invalid.
if (!parsed.success) {
  console.error(parsed.error.format());
  throw new Error('Invalid environment variables');
}

// Export validated environment variables.
export const env = parsed.data;

// Fail fast in production when secrets are still development defaults.
if (env.NODE_ENV === 'production') {
  const devSecrets = [
    env.USER_JWT_SECRET,
    env.ADMIN_ACCESS_TOKEN_SECRET,
    env.TELEGRAM_BOT_TOKEN,
    env.TELEGRAM_WEBHOOK_SECRET,
    env.CHAPA_SECRET_KEY,
    env.CHAPA_WEBHOOK_SECRET,
    env.TELEBIRR_APP_ID,
    env.TELEBIRR_APP_KEY,
    env.TELEBIRR_WEBHOOK_SECRET
  ];

  // Reject obvious development secrets in production.
  if (devSecrets.some((value) => String(value).startsWith('dev-'))) {
    throw new Error('Development secrets are not allowed in production');
  }

  // Reject default database password in production.
  if (env.DB_PASSWORD === 'changeme') {
    throw new Error('DB_PASSWORD must be changed in production');
  }

  // Reject default super admin password in production.
  if (env.SUPER_ADMIN_PASSWORD === 'ChangeMe123!') {
    throw new Error('SUPER_ADMIN_PASSWORD must be changed in production');
  }
}
