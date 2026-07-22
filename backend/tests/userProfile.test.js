// Import Vitest helpers.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Import HTTP test client.
import request from 'supertest';

// Import crypto for initData generation.
import crypto from 'node:crypto';

// Import jsonwebtoken for scope tests.
import jwt from 'jsonwebtoken';

// Declare dynamic imports.
let app;
let pool;
let redis;

// Unique test suffix.
const stamp = Date.now().toString().slice(-8);

// Unique Telegram IDs.
const telegramA = Number('91000000' + stamp);
const telegramB = Number('91000100' + stamp);
const telegramUnknown = Number('91000999' + stamp);

// Unique phone numbers.
const phoneA = '+251910' + stamp;
const phoneB = '+251911' + stamp;

// Seeded reference IDs.
const bankId = 1;
const regionId = 16;
const zoneId = 25;
const mismatchZoneId = 2;
const gradeId = 7;

// Auth token for active test user.
let tokenA;

// Active test user ID.
let userIdA;

// Create valid Telegram initData for tests.
function makeInitData(telegramId, username) {
  const authDate = Math.floor(Date.now() / 1000);
  const user = JSON.stringify({ id: telegramId, username: username });

  const params = new URLSearchParams();
  params.set('auth_date', String(authDate));
  params.set('user', user);

  const entries = Array.from(params.entries()).sort((a, b) => {
    if (a[0] === b[0]) {
      return 0;
    }
    return a[0] < b[0] ? -1 : 1;
  });

  const dataCheckString = entries
    .map((entry) => entry[0] + '=' + entry[1])
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(process.env.TELEGRAM_BOT_TOKEN)
    .digest();

  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  params.set('hash', hash);

  return params.toString();
}

// Setup before all tests.
beforeAll(async () => {
  // Force test environment.
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';

  // Override auth settings for deterministic tests.
  process.env.TELEGRAM_BOT_TOKEN = 'dev-test-token';
  process.env.USER_JWT_SECRET = 'test-user-secret';
  process.env.USER_JWT_EXPIRES_IN = '30d';

  // Dynamically import app after env overrides.
  const appModule = await import('../src/app.js');
  app = appModule.default;

  const poolModule = await import('../src/db/pool.js');
  pool = poolModule.pool;

  const redisModule = await import('../src/lib/redis.js');
  redis = redisModule.redis;

  // Clean possible leftover test users.
  await pool.query('DELETE FROM users WHERE telegram_id IN (?, ?)', [telegramA, telegramB]);

  // Create active incomplete test user.
  const [resultA] = await pool.query(
    'INSERT INTO users (' +
    'telegram_id, telegram_username, phone_number, bank_id, region_id, zone_id, ' +
    'preferred_language, photo_source, is_active' +
    ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)',
    [telegramA, 'profile_test_a', phoneA, bankId, regionId, zoneId, 'en', 'placeholder']
  );

  userIdA = resultA.insertId;

  // Create disabled test user.
  await pool.query(
    'INSERT INTO users (' +
    'telegram_id, telegram_username, phone_number, bank_id, region_id, zone_id, ' +
    'preferred_language, photo_source, is_active' +
    ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE)',
    [telegramB, 'profile_test_b', phoneB, bankId, regionId, zoneId, 'en', 'placeholder']
  );
});

// Cleanup after all tests.
afterAll(async () => {
  // Delete test users.
  await pool.query('DELETE FROM users WHERE telegram_id IN (?, ?)', [telegramA, telegramB]);

  // Close MySQL pool.
  await pool.end();

  // Close Redis connection.
  redis.disconnect();
});

// User auth and profile test suite.
describe('User Auth + Profile API', () => {
  // Test invalid initData.
  it('rejects invalid initData', async () => {
    const res = await request(app)
      .post('/api/v1/auth/telegram')
      .send({ init_data: 'hash=invalid' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  // Test unregistered Telegram user.
  it('rejects unregistered Telegram user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/telegram')
      .send({ init_data: makeInitData(telegramUnknown, 'unknown_user') });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  // Test successful Telegram auth.
  it('issues a user JWT for an existing Telegram user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/telegram')
      .send({ init_data: makeInitData(telegramA, 'profile_test_a') });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user_id).toBe(userIdA);
    expect(res.body.data.profile_complete).toBe(false);

    tokenA = res.body.data.token;
  });

  // Test disabled user auth.
  it('rejects disabled user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/telegram')
      .send({ init_data: makeInitData(telegramB, 'profile_test_b') });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  // Test missing token on profile route.
  it('rejects missing token on /me', async () => {
    const res = await request(app).get('/api/v1/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  // Test staff-scope token rejection.
  it('rejects staff-scope token on user route', async () => {
    const staffScopeToken = jwt.sign(
      { sub: userIdA, scope: 'staff', bankId: bankId },
      process.env.USER_JWT_SECRET,
      { expiresIn: '1m' }
    );

    const res = await request(app)
      .get('/api/v1/me')
      .set('Authorization', 'Bearer ' + staffScopeToken);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SCOPE_FORBIDDEN');
  });

  // Test profile GET.
  it('returns nested profile', async () => {
    const res = await request(app)
      .get('/api/v1/me')
      .set('Authorization', 'Bearer ' + tokenA);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user_id).toBe(userIdA);
    expect(res.body.data.bank.id).toBe(bankId);
    expect(res.body.data.region.id).toBe(regionId);
    expect(res.body.data.zone.id).toBe(zoneId);
    expect(res.body.data.grade).toBe(null);
    expect(res.body.data.profile_complete).toBe(false);
  });

  // Test bank immutability.
  it('rejects bank change', async () => {
    const res = await request(app)
      .put('/api/v1/me')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({ bank_id: 2 });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('BANK_CHANGE_UNSUPPORTED');
  });

  // Test zone-region mismatch.
  it('rejects zone-region mismatch', async () => {
    const res = await request(app)
      .put('/api/v1/me')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({ region_id: regionId, zone_id: mismatchZoneId });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ZONE_REGION_MISMATCH');
  });

  // Test branch minimum length.
  it('rejects branch name shorter than 3 characters', async () => {
    const res = await request(app)
      .put('/api/v1/me')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({ branch_name_en: 'Ad' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  // Test profile completion with English only.
  it('completes profile with English-only fields', async () => {
    const res = await request(app)
      .put('/api/v1/me')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({
        full_name_en: 'Test User',
        branch_name_en: 'Test Branch',
        neighborhood_en: 'Bole',
        grade_id: gradeId,
        region_id: regionId,
        zone_id: zoneId
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.updated).toBe(true);
    expect(res.body.data.profile_complete).toBe(true);
  });

  // Test completeness with missing Amharic and encouraged fields.
  it('returns language-aware completeness nudge after English-only completion', async () => {
    const res = await request(app)
      .get('/api/v1/me/completeness')
      .set('Authorization', 'Bearer ' + tokenA);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.is_marketplace_unlocked).toBe(true);
    expect(res.body.data.is_fully_complete).toBe(false);
    expect(res.body.data.missing_required).toEqual([]);
    expect(res.body.data.missing_encouraged).toContain('full_name_am');
    expect(res.body.data.missing_encouraged).toContain('branch_name_am');
    expect(res.body.data.missing_encouraged).toContain('neighborhood_am');
    expect(res.body.data.missing_encouraged).toContain('transfer_interest');
    expect(res.body.data.missing_encouraged).toContain('custom_photo');
    expect(res.body.data.nudge.show).toBe(true);
    expect(res.body.data.nudge.message_code).toBe('ADD_MISSING_LANGUAGE_AM');
  });

  // Test adding Amharic fields.
  it('adds Amharic fields and updates encouraged completeness', async () => {
    const updateRes = await request(app)
      .put('/api/v1/me')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({
        full_name_am: 'የሙከራ ተጠቃሚ',
        branch_name_am: 'የሙከራ ቅርንጫፍ',
        neighborhood_am: 'ቦሌ'
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.profile_complete).toBe(true);

    const completenessRes = await request(app)
      .get('/api/v1/me/completeness')
      .set('Authorization', 'Bearer ' + tokenA);

    expect(completenessRes.status).toBe(200);
    expect(completenessRes.body.success).toBe(true);
    expect(completenessRes.body.data.is_marketplace_unlocked).toBe(true);
    expect(completenessRes.body.data.is_fully_complete).toBe(false);
    expect(completenessRes.body.data.missing_encouraged).not.toContain('full_name_am');
    expect(completenessRes.body.data.missing_encouraged).not.toContain('branch_name_am');
    expect(completenessRes.body.data.missing_encouraged).not.toContain('neighborhood_am');
    expect(completenessRes.body.data.missing_encouraged).toContain('transfer_interest');
    expect(completenessRes.body.data.missing_encouraged).toContain('custom_photo');
    expect(completenessRes.body.data.nudge.message_code).toBe('ADD_TRANSFER_INTEREST');
  });

  // Test non-production issue-token helper.
  it('issues a token via internal helper outside production', async () => {
    const res = await request(app)
      .post('/api/v1/auth/issue-token')
      .send({ telegram_id: telegramA });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user_id).toBe(userIdA);
  });
});
