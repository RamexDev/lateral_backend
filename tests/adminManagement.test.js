// Import Vitest helpers.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// Import HTTP test client.
import request from 'supertest';
// Import bcrypt.
import { hash } from '@node-rs/bcrypt';

// Declare dynamic imports.
let app;
let pool;
let redis;

// Unique test suffix.
const stamp = Date.now().toString().slice(-6);

// Test staff credentials.
const superAdminEmail = 'mgmt.super.' + stamp + '@zwuwur.app';
const adminEmail = 'mgmt.admin.' + stamp + '@zwuwur.app';
const testPassword = 'MgmtTestPassword123!';

// Test user.
const userTelegramId = Number('9600000' + stamp);

// Tokens.
let superAdminToken;
let adminToken;

// User ID.
let testUserId;

// Setup.
beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';
  process.env.TELEGRAM_BOT_TOKEN = 'dev-test-token';
  process.env.USER_JWT_SECRET = process.env.USER_JWT_SECRET || 'test-user-secret';
  process.env.USER_JWT_EXPIRES_IN = '30d';
  process.env.ADMIN_ACCESS_TOKEN_SECRET = process.env.ADMIN_ACCESS_TOKEN_SECRET || 'test-admin-access-secret';
  process.env.ADMIN_ACCESS_TOKEN_EXPIRES_IN = '15m';
  process.env.ADMIN_REFRESH_TOKEN_EXPIRES_IN = '7d';

  const appModule = await import('../src/app.js');
  app = appModule.default;
  const poolModule = await import('../src/db/pool.js');
  pool = poolModule.pool;
  const redisModule = await import('../src/lib/redis.js');
  redis = redisModule.redis;

  // Cleanup.
  await pool.query('DELETE FROM staff_refresh_tokens WHERE staff_id IN (SELECT id FROM staff WHERE email IN (?, ?))', [superAdminEmail, adminEmail]);
  await pool.query('DELETE FROM staff WHERE email IN (?, ?)', [superAdminEmail, adminEmail]);
  await pool.query('DELETE FROM users WHERE telegram_id = ?', [userTelegramId]);

  // Create super_admin.
  const passwordHash = await hash(testPassword, 10);
  await pool.query('INSERT INTO staff (full_name, email, password_hash, role, preferred_language, is_active) VALUES (?, ?, ?, ?, ?, TRUE)',
    ['Super Admin', superAdminEmail, passwordHash, 'super_admin', 'en']);

  // Create admin.
  await pool.query('INSERT INTO staff (full_name, email, password_hash, role, preferred_language, is_active) VALUES (?, ?, ?, ?, ?, TRUE)',
    ['Regular Admin', adminEmail, passwordHash, 'admin', 'en']);

  // Login both.
  const superRes = await request(app).post('/admin/api/v1/auth/login').send({ email: superAdminEmail, password: testPassword });
  superAdminToken = superRes.body.data.token;

  const adminRes = await request(app).post('/admin/api/v1/auth/login').send({ email: adminEmail, password: testPassword });
  adminToken = adminRes.body.data.token;

  // Create a test user.
  const [userResult] = await pool.query(
    'INSERT INTO users (telegram_id, telegram_username, phone_number, bank_id, region_id, zone_id, grade_id, full_name_en, branch_name_en, neighborhood_en, preferred_language, photo_source, is_active, profile_completed_at) VALUES (?, ?, ?, 1, 16, 25, 7, ?, ?, ?, ?, ?, TRUE, NOW())',
    [userTelegramId, 'mgmt_user_' + stamp, '+251960' + stamp, 'Mgmt Test User', 'Mgmt Branch', 'Mgmt Hood', 'en', 'placeholder']
  );
  testUserId = userResult.insertId;
});

// Cleanup.
afterAll(async () => {
  await pool.query('DELETE FROM staff_refresh_tokens WHERE staff_id IN (SELECT id FROM staff WHERE email IN (?, ?))', [superAdminEmail, adminEmail]);
  await pool.query('DELETE FROM staff WHERE email IN (?, ?)', [superAdminEmail, adminEmail]);
  await pool.query('DELETE FROM users WHERE telegram_id = ?', [userTelegramId]);
  await pool.end();
  redis.disconnect();
});

// Test suite.
describe('Admin Management + Reports API', () => {
  // Dashboard.
  it('returns dashboard summary', async () => {
    const res = await request(app)
      .get('/admin/api/v1/dashboard/summary')
      .set('Authorization', 'Bearer ' + adminToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.active_users).toBeGreaterThanOrEqual(1);
    expect(res.body.data.total_interests).toBeGreaterThanOrEqual(0);
    expect(typeof res.body.data.revenue_etb).toBe('number');
  });

  // User list with phone masking.
  it('lists users with masked phone numbers', async () => {
    const res = await request(app)
      .get('/admin/api/v1/users?page=1&page_size=10')
      .set('Authorization', 'Bearer ' + adminToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.results.length).toBeGreaterThanOrEqual(1);
    // Phone should be masked.
    const user = res.body.data.results.find((u) => u.id === testUserId);
    expect(user).toBeTruthy();
    expect(user.phone_number).toContain('***');
    expect(user.phone_number).not.toBe('+251960' + stamp);
  });

  // User detail with full phone.
  it('returns full user detail with unmasked phone', async () => {
    const res = await request(app)
      .get('/admin/api/v1/users/' + testUserId)
      .set('Authorization', 'Bearer ' + adminToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.profile.phone_number).toBe('+251960' + stamp);
    expect(res.body.data.profile.full_name_en).toBe('Mgmt Test User');
    expect(res.body.data.stats).toBeTruthy();
  });

  // User deactivation.
  it('deactivates a user', async () => {
    const res = await request(app)
      .patch('/admin/api/v1/users/' + testUserId + '/status')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ is_active: false, reason: 'Test deactivation' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.is_active).toBe(false);
  });

  // User reactivation.
  it('reactivates a user', async () => {
    const res = await request(app)
      .patch('/admin/api/v1/users/' + testUserId + '/status')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ is_active: true });
    expect(res.status).toBe(200);
    expect(res.body.data.is_active).toBe(true);
  });

  // Staff list (super_admin only).
  it('lists staff for super_admin', async () => {
    const res = await request(app)
      .get('/admin/api/v1/staff')
      .set('Authorization', 'Bearer ' + superAdminToken);
    expect(res.status).toBe(200);
    expect(res.body.data.results.length).toBeGreaterThanOrEqual(2);
  });

  // Staff list rejected for admin role.
  it('rejects staff list for admin role', async () => {
    const res = await request(app)
      .get('/admin/api/v1/staff')
      .set('Authorization', 'Bearer ' + adminToken);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
  });

  // Create staff (super_admin only).
  it('creates a staff account', async () => {
    const newEmail = 'mgmt.new.' + stamp + '@zwuwur.app';
    const res = await request(app)
      .post('/admin/api/v1/staff')
      .set('Authorization', 'Bearer ' + superAdminToken)
      .send({ full_name: 'New Staff', email: newEmail, password: 'NewStaffPass123!', role: 'admin', preferred_language: 'en' });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeTruthy();
    // Cleanup.
    await pool.query('DELETE FROM staff WHERE email = ?', [newEmail]);
  });

  // Create staff rejected for admin role.
  it('rejects staff creation for admin role', async () => {
    const res = await request(app)
      .post('/admin/api/v1/staff')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ full_name: 'X', email: 'x@x.com', password: 'Pass12345!', role: 'admin' });
    expect(res.status).toBe(403);
  });

  // Revenue report.
  it('returns revenue report', async () => {
    const res = await request(app)
      .get('/admin/api/v1/reports/revenue?from=2026-01-01&to=2026-12-31')
      .set('Authorization', 'Bearer ' + adminToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.revenue_etb).toBe('number');
    expect(Array.isArray(res.body.data.by_bank)).toBe(true);
  });

  // User report.
  it('returns user report', async () => {
    const res = await request(app)
      .get('/admin/api/v1/reports/users?from=2026-01-01&to=2026-12-31')
      .set('Authorization', 'Bearer ' + adminToken);
    expect(res.status).toBe(200);
    expect(res.body.data.new_users).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.data.by_bank)).toBe(true);
  });

  // Interest report.
  it('returns interest report', async () => {
    const res = await request(app)
      .get('/admin/api/v1/reports/interests')
      .set('Authorization', 'Bearer ' + adminToken);
    expect(res.status).toBe(200);
    expect(typeof res.body.data.total_interests).toBe('number');
    expect(Array.isArray(res.body.data.by_region)).toBe(true);
  });

  // System health.
  it('returns system health', async () => {
    const res = await request(app)
      .get('/admin/api/v1/system/health')
      .set('Authorization', 'Bearer ' + adminToken);
    expect(res.status).toBe(200);
    expect(res.body.data.mysql).toBe('ok');
    expect(res.body.data.redis).toBe('ok');
  });

  // Unauthenticated rejection.
  it('rejects unauthenticated dashboard request', async () => {
    const res = await request(app).get('/admin/api/v1/dashboard/summary');
    expect(res.status).toBe(401);
  });
});
