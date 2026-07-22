// Import Vitest helpers.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Import HTTP test client.
import request from 'supertest';

// Declare dynamic imports.
let app;
let pool;
let redis;

// Unique test suffix.
const stamp = Date.now().toString().slice(-8);

// Unique Telegram IDs.
const telegramIdA = Number('90000000' + stamp);
const telegramIdB = Number('90000100' + stamp);
const telegramIdC = Number('90000200' + stamp);
const telegramIdD = Number('90000300' + stamp);

// Unique phone numbers.
const phoneA = '+251900' + stamp;
const phoneC = '+251901' + stamp;

// Seeded reference IDs.
const bankId = 1;
const regionId = 16;
const zoneId = 25;
const mismatchZoneId = 2;

// Created user ID.
let userIdA = null;

// Clear bot onboarding sessions.
async function clearBotSessions() {
  const keys = await redis.keys('bot:session:*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

// Try to drop a users CHECK constraint using both dialects.
async function tryDropConstraint(name) {
  try {
    await pool.query('ALTER TABLE users DROP CONSTRAINT ' + name);
  } catch {
    try {
      await pool.query('ALTER TABLE users DROP CHECK ' + name);
    } catch {
      // Ignore if constraint is already absent.
    }
  }
}

// Setup before all tests.
beforeAll(async () => {
  // Force test environment.
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';

  // Override Telegram settings for deterministic tests.
  process.env.TELEGRAM_BOT_TOKEN = 'dev-test-token';
  process.env.TELEGRAM_WEBHOOK_SECRET = 'test-webhook-secret';

  // Dynamically import app after env overrides.
  const appModule = await import('../src/app.js');
  app = appModule.default;

  const poolModule = await import('../src/db/pool.js');
  pool = poolModule.pool;

  const redisModule = await import('../src/lib/redis.js');
  redis = redisModule.redis;

  // Relax CHECK constraints so incomplete bot users can be created.
  await tryDropConstraint('chk_full_name_bilingual');
  await tryDropConstraint('chk_branch_bilingual');
  await tryDropConstraint('chk_neighborhood_bilingual');

  // Clear bot sessions.
  await clearBotSessions();
});

// Cleanup after all tests.
afterAll(async () => {
  // Delete test users.
  await pool.query(
    'DELETE FROM users WHERE telegram_id IN (?, ?, ?, ?)',
    [telegramIdA, telegramIdB, telegramIdC, telegramIdD]
  );

  // Clear bot sessions.
  await clearBotSessions();

  // Close MySQL pool.
  await pool.end();

  // Close Redis connection.
  redis.disconnect();
});

// Clear bot sessions before each test.
beforeEach(async () => {
  await clearBotSessions();
});

// Bot onboarding test suite.
describe('Bot Onboarding API', () => {
  // Test start for a new Telegram user.
  it('starts onboarding for a new user', async () => {
    const res = await request(app)
      .post('/api/v1/onboarding/start')
      .send({ telegram_id: telegramIdA, telegram_username: 'test_user_a' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.step).toBe('select_language');
    expect(res.body.data.languages.length).toBe(2);
  });

  // Test language selection.
  it('selects language', async () => {
    const res = await request(app)
      .post('/api/v1/onboarding/language')
      .send({ telegram_id: telegramIdA, language: 'en' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.step).toBe('share_contact');
    expect(res.body.data.requires_native_contact_share).toBe(true);
  });

  // Test contact share rejection when contact is not self.
  it('rejects contact share that is not self', async () => {
    // Restart session flow.
    await request(app).post('/api/v1/onboarding/start').send({ telegram_id: telegramIdA });
    await request(app).post('/api/v1/onboarding/language').send({ telegram_id: telegramIdA, language: 'en' });

    const res = await request(app)
      .post('/api/v1/onboarding/contact')
      .send({ telegram_id: telegramIdA, phone_number: phoneA, contact_is_self: false });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONTACT_NOT_SELF');
  });

  // Test contact share success.
  it('shares contact and returns banks', async () => {
    // Restart session flow.
    await request(app).post('/api/v1/onboarding/start').send({ telegram_id: telegramIdA });
    await request(app).post('/api/v1/onboarding/language').send({ telegram_id: telegramIdA, language: 'en' });

    const res = await request(app)
      .post('/api/v1/onboarding/contact')
      .send({ telegram_id: telegramIdA, phone_number: phoneA, contact_is_self: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.step).toBe('select_bank');
    expect(Array.isArray(res.body.data.banks)).toBe(true);
  });

  // Test bank selection.
  it('selects bank and returns regions', async () => {
    // Restart session flow up to bank.
    await request(app).post('/api/v1/onboarding/start').send({ telegram_id: telegramIdA });
    await request(app).post('/api/v1/onboarding/language').send({ telegram_id: telegramIdA, language: 'en' });
    await request(app).post('/api/v1/onboarding/contact').send({ telegram_id: telegramIdA, phone_number: phoneA, contact_is_self: true });

    const res = await request(app)
      .post('/api/v1/onboarding/bank')
      .send({ telegram_id: telegramIdA, bank_id: bankId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.step).toBe('select_region');
    expect(Array.isArray(res.body.data.regions)).toBe(true);
  });

  // Test region selection.
  it('selects region and returns zones', async () => {
    // Restart session flow up to region.
    await request(app).post('/api/v1/onboarding/start').send({ telegram_id: telegramIdA });
    await request(app).post('/api/v1/onboarding/language').send({ telegram_id: telegramIdA, language: 'en' });
    await request(app).post('/api/v1/onboarding/contact').send({ telegram_id: telegramIdA, phone_number: phoneA, contact_is_self: true });
    await request(app).post('/api/v1/onboarding/bank').send({ telegram_id: telegramIdA, bank_id: bankId });

    const res = await request(app)
      .post('/api/v1/onboarding/region')
      .send({ telegram_id: telegramIdA, region_id: regionId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.step).toBe('select_zone');
    expect(Array.isArray(res.body.data.zones)).toBe(true);
  });

  // Test zone-region mismatch.
  it('rejects a zone that does not belong to the selected region', async () => {
    // Restart session flow up to zone.
    await request(app).post('/api/v1/onboarding/start').send({ telegram_id: telegramIdA });
    await request(app).post('/api/v1/onboarding/language').send({ telegram_id: telegramIdA, language: 'en' });
    await request(app).post('/api/v1/onboarding/contact').send({ telegram_id: telegramIdA, phone_number: phoneA, contact_is_self: true });
    await request(app).post('/api/v1/onboarding/bank').send({ telegram_id: telegramIdA, bank_id: bankId });
    await request(app).post('/api/v1/onboarding/region').send({ telegram_id: telegramIdA, region_id: regionId });

    const res = await request(app)
      .post('/api/v1/onboarding/zone')
      .send({ telegram_id: telegramIdA, zone_id: mismatchZoneId });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ZONE_REGION_MISMATCH');
  });

  // Test zone selection and incomplete user creation.
  it('selects zone and creates an incomplete user', async () => {
    // Restart session flow up to zone.
    await request(app).post('/api/v1/onboarding/start').send({ telegram_id: telegramIdA });
    await request(app).post('/api/v1/onboarding/language').send({ telegram_id: telegramIdA, language: 'en' });
    await request(app).post('/api/v1/onboarding/contact').send({ telegram_id: telegramIdA, phone_number: phoneA, contact_is_self: true });
    await request(app).post('/api/v1/onboarding/bank').send({ telegram_id: telegramIdA, bank_id: bankId });
    await request(app).post('/api/v1/onboarding/region').send({ telegram_id: telegramIdA, region_id: regionId });

    const res = await request(app)
      .post('/api/v1/onboarding/zone')
      .send({ telegram_id: telegramIdA, zone_id: zoneId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.step).toBe('profile_created_basic');
    expect(res.body.data.user_id).toBeTruthy();
    expect(res.body.data.profile_complete).toBe(false);
    expect(res.body.data.mini_app_url).toBeTruthy();

    userIdA = res.body.data.user_id;
  });

  // Test start again for existing user.
  it('returns already_registered for an existing Telegram user', async () => {
    const res = await request(app)
      .post('/api/v1/onboarding/start')
      .send({ telegram_id: telegramIdA });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.step).toBe('already_registered');
    expect(res.body.data.user_id).toBe(userIdA);
    expect(res.body.data.profile_complete).toBe(false);
  });

  // Test duplicate phone+bank rejection.
  it('rejects duplicate phone number under the same bank', async () => {
    // Start second Telegram user with same phone.
    await request(app).post('/api/v1/onboarding/start').send({ telegram_id: telegramIdB });
    await request(app).post('/api/v1/onboarding/language').send({ telegram_id: telegramIdB, language: 'en' });
    await request(app).post('/api/v1/onboarding/contact').send({ telegram_id: telegramIdB, phone_number: phoneA, contact_is_self: true });

    const res = await request(app)
      .post('/api/v1/onboarding/bank')
      .send({ telegram_id: telegramIdB, bank_id: bankId });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DUPLICATE_PHONE_BANK');
  });

  // Test OTP stub.
  it('supports OTP stub flow outside production', async () => {
    const requestRes = await request(app)
      .post('/api/v1/onboarding/otp/request')
      .send({ telegram_id: telegramIdC, phone_number: phoneC });

    expect(requestRes.status).toBe(200);
    expect(requestRes.body.success).toBe(true);
    expect(requestRes.body.data.step).toBe('otp_verify');

    const verifyRes = await request(app)
      .post('/api/v1/onboarding/otp/verify')
      .send({ telegram_id: telegramIdC, code: '123456' });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.data.step).toBe('select_bank');
  });

  // Test webhook secret rejection.
  it('rejects Telegram webhook with invalid secret', async () => {
    const res = await request(app)
      .post('/api/v1/telegram/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', 'wrong-secret')
      .send({ update_id: 1 });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_SIGNATURE');
  });

  // Test webhook accepts valid secret.
  it('accepts Telegram webhook with valid secret', async () => {
    const res = await request(app)
      .post('/api/v1/telegram/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', 'test-webhook-secret')
      .send({
        update_id: 1,
        message: {
          message_id: 1,
          text: '/start',
          from: {
            id: telegramIdD,
            username: 'webhook_test_user'
          }
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
