// Import Vitest helpers.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Import HTTP test client.
import request from 'supertest';

// Import bcrypt implementation.
import { hash } from '@node-rs/bcrypt';

// Declare dynamic imports.
let app;
let pool;
let redis;

// Unique test suffix.
const stamp = Date.now().toString().slice(-8);

// Test staff credentials.
const staffEmail = 'reference.admin.' + stamp + '@zwuwur.app';
const staffPassword = 'ReferenceTestPassword123!';

// Test auth token.
let token;

// Test entity IDs.
let bankId = null;
let regionId = null;
let zoneId = null;
let gradeId = null;
let userId = null;

// Fixed test grade number.
const testGradeNumber = 201;

// Clear admin login rate-limit keys.
async function clearRateLimits() {
  const keys = await redis.keys('rl:admin-login:*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

// Setup before all tests.
beforeAll(async () => {
  // Force test environment.
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';

  // Override admin auth env for deterministic tests.
  process.env.ADMIN_ACCESS_TOKEN_SECRET = process.env.ADMIN_ACCESS_TOKEN_SECRET || 'test-admin-access-secret';
  process.env.ADMIN_ACCESS_TOKEN_EXPIRES_IN = '15m';
  process.env.ADMIN_REFRESH_TOKEN_EXPIRES_IN = '7d';

  // Dynamically import app after env overrides.
  const appModule = await import('../src/app.js');
  app = appModule.default;

  const poolModule = await import('../src/db/pool.js');
  pool = poolModule.pool;

  const redisModule = await import('../src/lib/redis.js');
  redis = redisModule.redis;

  // Clear login rate limits.
  await clearRateLimits();

  // Clean possible leftover test grade.
  await pool.query('DELETE FROM users WHERE grade_id IN (SELECT id FROM grades WHERE grade_number = ?)', [testGradeNumber]);
  await pool.query('DELETE FROM grades WHERE grade_number = ?', [testGradeNumber]);

  // Create test staff.
  const passwordHash = await hash(staffPassword, 10);
  await pool.query(
    'INSERT INTO staff (full_name, email, password_hash, role, preferred_language, is_active) VALUES (?, ?, ?, ?, ?, ?)',
    ['Reference Test Admin', staffEmail, passwordHash, 'admin', 'en', true]
  );

  // Login test staff.
  const loginRes = await request(app)
    .post('/admin/api/v1/auth/login')
    .send({ email: staffEmail, password: staffPassword });

  token = loginRes.body.data.token;
});

// Cleanup after all tests.
afterAll(async () => {
  // Delete test user first.
  if (userId) {
    await pool.query('DELETE FROM users WHERE id = ?', [userId]);
  }

  // Delete zone before region.
  if (zoneId) {
    await pool.query('DELETE FROM zones WHERE id = ?', [zoneId]);
  }

  // Delete region.
  if (regionId) {
    await pool.query('DELETE FROM regions WHERE id = ?', [regionId]);
  }

  // Delete bank.
  if (bankId) {
    await pool.query('DELETE FROM banks WHERE id = ?', [bankId]);
  }

  // Delete grade.
  if (gradeId) {
    await pool.query('DELETE FROM grades WHERE grade_number = ?', [testGradeNumber]);
  }

  // Delete staff refresh tokens.
  await pool.query(
    'DELETE FROM staff_refresh_tokens WHERE staff_id IN (SELECT id FROM staff WHERE email = ?)',
    [staffEmail]
  );

  // Delete staff.
  await pool.query('DELETE FROM staff WHERE email = ?', [staffEmail]);

  // Clear rate limits.
  await clearRateLimits();

  // Close MySQL pool.
  await pool.end();

  // Close Redis connection.
  redis.disconnect();
});

// Clear rate limits before each test.
beforeEach(async () => {
  await clearRateLimits();
});

// Admin reference-data test suite.
describe('Admin Reference Data API', () => {
  // Test missing authentication.
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/admin/api/v1/banks');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  // Test bank creation.
  it('creates a bank', async () => {
    const res = await request(app)
      .post('/admin/api/v1/banks')
      .set('Authorization', 'Bearer ' + token)
      .send({
        name_en: 'Reference Test Bank',
        name_am: 'የሙከራ ባንክ',
        alias_en: 'ref-test-bank-' + stamp,
        alias_am: 'ሙከራ-' + stamp,
        swift_code: 'REFETAA',
        year_established: 2020,
        year_established_note: 'test note'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.name_en).toBe('Reference Test Bank');
    expect(res.body.data.nickname).toBe('ref-test-bank-' + stamp);

    bankId = res.body.data.id;
  });

  // Test bank update.
  it('updates a bank', async () => {
    const res = await request(app)
      .patch('/admin/api/v1/banks/' + bankId)
      .set('Authorization', 'Bearer ' + token)
      .send({ name_en: 'Reference Test Bank Updated' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name_en).toBe('Reference Test Bank Updated');
  });

  // Test duplicate bank alias.
  it('rejects duplicate bank alias', async () => {
    const res = await request(app)
      .post('/admin/api/v1/banks')
      .set('Authorization', 'Bearer ' + token)
      .send({
        name_en: 'Another Test Bank',
        name_am: 'ሌላ የሙከራ ባንክ',
        alias_en: 'ref-test-bank-' + stamp,
        alias_am: 'ሌላ-ሙከራ-' + stamp
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DUPLICATE_ENTRY');
  });

  // Test region creation.
  it('creates a region', async () => {
    const res = await request(app)
      .post('/admin/api/v1/regions')
      .set('Authorization', 'Bearer ' + token)
      .send({
        name_en: 'Reference Test Region',
        name_am: 'የሙከራ ክልል',
        type: 'region'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeTruthy();

    regionId = res.body.data.id;
  });

  // Test zone creation.
  it('creates a zone under an active region', async () => {
    const res = await request(app)
      .post('/admin/api/v1/zones')
      .set('Authorization', 'Bearer ' + token)
      .send({
        region_id: regionId,
        name_en: 'Reference Test Zone',
        name_am: 'የሙከራ ዞን'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.region_id).toBe(regionId);

    zoneId = res.body.data.id;
  });

  // Test grade creation.
  it('creates a grade', async () => {
    const res = await request(app)
      .post('/admin/api/v1/grades')
      .set('Authorization', 'Bearer ' + token)
      .send({
        grade_number: testGradeNumber,
        band_label_en: 'Test Band',
        band_label_am: 'የሙከራ ባንድ',
        tier_classification_en: 'Grade ' + testGradeNumber,
        tier_classification_am: 'ደረጃ ' + testGradeNumber
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.grade_number).toBe(testGradeNumber);
    expect(res.body.data.band_number).toBe(Math.ceil(testGradeNumber / 3));

    gradeId = res.body.data.id;
  });

  // Create an active user referencing all test entities.
  it('creates a test user directly in the database', async () => {
    const telegramId = Number(Date.now().toString().slice(0, 13));
    const phone = '+251900' + stamp;

    const [result] = await pool.query(
      'INSERT INTO users (' +
      'telegram_id, telegram_username, phone_number, bank_id, region_id, zone_id, grade_id, ' +
      'full_name_en, branch_name_en, neighborhood_en, preferred_language, is_active' +
      ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        telegramId,
        'ref_test_' + stamp,
        phone,
        bankId,
        regionId,
        zoneId,
        gradeId,
        'Reference Test User',
        'Reference Test Branch',
        'Reference Test Neighborhood',
        'en',
        true
      ]
    );

    userId = result.insertId;
    expect(userId).toBeTruthy();
  });

  // Test bank deactivation guard.
  it('blocks bank deactivation while active users exist', async () => {
    const res = await request(app)
      .patch('/admin/api/v1/banks/' + bankId)
      .set('Authorization', 'Bearer ' + token)
      .send({ is_active: false });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('BANK_HAS_ACTIVE_USERS');
  });

  // Test region deactivation guard.
  it('blocks region deactivation while active users or zones exist', async () => {
    const res = await request(app)
      .patch('/admin/api/v1/regions/' + regionId)
      .set('Authorization', 'Bearer ' + token)
      .send({ is_active: false });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('REGION_HAS_ACTIVE_USERS');
  });

  // Test zone deactivation guard.
  it('blocks zone deactivation while active users exist', async () => {
    const res = await request(app)
      .patch('/admin/api/v1/zones/' + zoneId)
      .set('Authorization', 'Bearer ' + token)
      .send({ is_active: false });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ZONE_HAS_ACTIVE_USERS');
  });

  // Test grade deactivation guard.
  it('blocks grade deactivation while active users exist', async () => {
    const res = await request(app)
      .patch('/admin/api/v1/grades/' + gradeId)
      .set('Authorization', 'Bearer ' + token)
      .send({ is_active: false });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('GRADE_HAS_ACTIVE_USERS');
  });

  // Deactivate the test user directly.
  it('deactivates the test user', async () => {
    await pool.query('UPDATE users SET is_active = FALSE WHERE id = ?', [userId]);
    const [rows] = await pool.query('SELECT is_active FROM users WHERE id = ?', [userId]);
    expect(Boolean(rows[0].is_active)).toBe(false);
  });

  // Test grade deactivation after user inactive.
  it('allows grade deactivation after active user is removed', async () => {
    const res = await request(app)
      .patch('/admin/api/v1/grades/' + gradeId)
      .set('Authorization', 'Bearer ' + token)
      .send({ is_active: false });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.is_active).toBe(false);
  });

  // Test zone deactivation after user inactive.
  it('allows zone deactivation after active user is removed', async () => {
    const res = await request(app)
      .patch('/admin/api/v1/zones/' + zoneId)
      .set('Authorization', 'Bearer ' + token)
      .send({ is_active: false });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.is_active).toBe(false);
  });

  // Test region deactivation after zone inactive.
  it('allows region deactivation after active zones and users are removed', async () => {
    const res = await request(app)
      .patch('/admin/api/v1/regions/' + regionId)
      .set('Authorization', 'Bearer ' + token)
      .send({ is_active: false });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.is_active).toBe(false);
  });

  // Test bank deactivation after user inactive.
  it('allows bank deactivation after active user is removed', async () => {
    const res = await request(app)
      .patch('/admin/api/v1/banks/' + bankId)
      .set('Authorization', 'Bearer ' + token)
      .send({ is_active: false });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.is_active).toBe(false);
  });
});
