// Import Vitest helpers.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Import HTTP test client.
import request from 'supertest';

// Import bcrypt implementation.
import { hash } from '@node-rs/bcrypt';

// Import jsonwebtoken to create wrong-scope tokens.
import jwt from 'jsonwebtoken';

// Declare dynamic imports.
let app;
let pool;
let redis;

// Test staff emails.
const activeEmail = 'admin.auth.active.test@zwuwur.app';
const disabledEmail = 'admin.auth.disabled.test@zwuwur.app';

// Test password.
const testPassword = 'TestAdminPassword123!';

// Clear admin login rate-limit keys.
async function clearRateLimits() {
  const keys = await redis.keys('rl:admin-login:*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

// Clean test staff rows.
async function cleanTestStaff() {
  await pool.query(
    'DELETE FROM staff_refresh_tokens WHERE staff_id IN (SELECT id FROM staff WHERE email IN (?, ?))',
    [activeEmail, disabledEmail]
  );

  await pool.query(
    'DELETE FROM staff WHERE email IN (?, ?)',
    [activeEmail, disabledEmail]
  );
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

  // Remove old test data.
  await cleanTestStaff();

  // Hash test password.
  const passwordHash = await hash(testPassword, 10);

  // Create active test admin.
  await pool.query(
    'INSERT INTO staff (full_name, email, password_hash, role, preferred_language, is_active) VALUES (?, ?, ?, ?, ?, ?)',
    ['Active Test Admin', activeEmail, passwordHash, 'admin', 'en', true]
  );

  // Create disabled test admin.
  await pool.query(
    'INSERT INTO staff (full_name, email, password_hash, role, preferred_language, is_active) VALUES (?, ?, ?, ?, ?, ?)',
    ['Disabled Test Admin', disabledEmail, passwordHash, 'admin', 'en', false]
  );

  // Clear rate limits before tests.
  await clearRateLimits();
});

// Cleanup after all tests.
afterAll(async () => {
  // Remove test staff and tokens.
  await cleanTestStaff();

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

// Admin auth test suite.
describe('Admin Auth API', () => {
  // Shared tokens.
  let accessToken;
  let refreshToken;

  // Test successful login.
  it('logs in with valid credentials', async () => {
    const res = await request(app)
      .post('/admin/api/v1/auth/login')
      .send({ email: activeEmail, password: testPassword });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.refresh_token).toBeTruthy();
    expect(res.body.data.refresh_expires_at).toBeTruthy();
    expect(res.body.data.staff.email).toBe(activeEmail);
    expect(res.body.data.staff.role).toBe('admin');

    accessToken = res.body.data.token;
    refreshToken = res.body.data.refresh_token;
  });

  // Test /me with staff token.
  it('returns current staff profile', async () => {
    const res = await request(app)
      .get('/admin/api/v1/auth/me')
      .set('Authorization', 'Bearer ' + accessToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(activeEmail);
    expect(res.body.data.is_active).toBe(true);
  });

  // Test wrong password.
  it('rejects invalid password', async () => {
    const res = await request(app)
      .post('/admin/api/v1/auth/login')
      .send({ email: activeEmail, password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  // Test disabled account.
  it('rejects disabled staff account', async () => {
    const res = await request(app)
      .post('/admin/api/v1/auth/login')
      .send({ email: disabledEmail, password: testPassword });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  // Test wrong token scope.
  it('rejects user-scope token on admin route', async () => {
    const userScopeToken = jwt.sign(
      { sub: 1, scope: 'user' },
      process.env.ADMIN_ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
    );

    const res = await request(app)
      .get('/admin/api/v1/auth/me')
      .set('Authorization', 'Bearer ' + userScopeToken);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SCOPE_FORBIDDEN');
  });

  // Test refresh rotation and reuse detection.
  it('rotates refresh tokens and detects reuse', async () => {
    const firstRefresh = await request(app)
      .post('/admin/api/v1/auth/refresh')
      .send({ refresh_token: refreshToken });

    expect(firstRefresh.status).toBe(200);
    expect(firstRefresh.body.success).toBe(true);

    const newRefreshToken = firstRefresh.body.data.refresh_token;
    expect(newRefreshToken).toBeTruthy();
    expect(newRefreshToken).not.toBe(refreshToken);

    const reuseAttempt = await request(app)
      .post('/admin/api/v1/auth/refresh')
      .send({ refresh_token: refreshToken });

    expect(reuseAttempt.status).toBe(401);
    expect(reuseAttempt.body.error.code).toBe('INVALID_TOKEN');

    const newTokenAttempt = await request(app)
      .post('/admin/api/v1/auth/refresh')
      .send({ refresh_token: newRefreshToken });

    expect(newTokenAttempt.status).toBe(401);
    expect(newTokenAttempt.body.error.code).toBe('INVALID_TOKEN');
  });

  // Test logout revokes refresh token.
  it('logs out and revokes refresh token', async () => {
    const loginRes = await request(app)
      .post('/admin/api/v1/auth/login')
      .send({ email: activeEmail, password: testPassword });

    const freshRefreshToken = loginRes.body.data.refresh_token;

    const logoutRes = await request(app)
      .post('/admin/api/v1/auth/logout')
      .send({ refresh_token: freshRefreshToken });

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);
    expect(logoutRes.body.data.logged_out).toBe(true);

    const refreshRes = await request(app)
      .post('/admin/api/v1/auth/refresh')
      .send({ refresh_token: freshRefreshToken });

    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body.error.code).toBe('INVALID_TOKEN');
  });

  // Test admin login rate limiting.
  it('locks login after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post('/admin/api/v1/auth/login')
        .send({ email: activeEmail, password: 'bad-password' });
    }

    const res = await request(app)
      .post('/admin/api/v1/auth/login')
      .send({ email: activeEmail, password: 'bad-password' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('RATE_LIMITED');

    await clearRateLimits();
  });
});
