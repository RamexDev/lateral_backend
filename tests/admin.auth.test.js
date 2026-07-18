/**
 * Admin auth flow tests — login, refresh, logout, RBAC, router-token binding
 * (SEC-011, SEC-005, SEC-009 / answers.md §D).
 */
const request = require('supertest');
const { app, loginStaff } = require('./helpers');
const passwordUtil = require('../src/utils/password');
const staffRepo = require('../src/repositories/staffRepository');

describe('Admin auth flow', () => {
  describe('POST /admin/api/v1/auth/login', () => {
    it('returns a staff JWT + refresh token on valid credentials', async () => {
      const { token, refreshToken } = await loginStaff('super_admin');
      expect(token).toBeTruthy();
      expect(refreshToken).toBeTruthy();
      // Decoded payload should have scope=staff.
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      expect(payload.scope).toBe('staff');
      expect(payload.roleName).toBe('super_admin');
    });

    it('uses the reworded INVALID_CREDENTIALS message (answers.md §G)', async () => {
      const res = await request(app)
        .post('/admin/api/v1/auth/login')
        .send({ email: 'nobody@nowhere.local', password: 'whatever' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe(
        'The email or password you entered is incorrect.',
      );
    });

    it('rejects an unknown email (INVALID_CREDENTIALS)', async () => {
      const res = await request(app)
        .post('/admin/api/v1/auth/login')
        .send({ email: 'nobody@nowhere.local', password: 'whatever' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects a wrong password (INVALID_CREDENTIALS)', async () => {
      const email = `wrongpw-${Date.now()}@test.local`;
      const role = await staffRepo.findRoleByName('platform_admin');
      await staffRepo.create({
        full_name: 'Wrong PW',
        email,
        password_hash: await passwordUtil.hash('CorrectPassword123!'),
        role_id: role.id,
        preferred_language: 'en',
        is_active: true,
      });
      const res = await request(app)
        .post('/admin/api/v1/auth/login')
        .send({ email, password: 'WrongPassword456!' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects a disabled account (ACCOUNT_DISABLED)', async () => {
      const email = `disabled-${Date.now()}@test.local`;
      const role = await staffRepo.findRoleByName('platform_admin');
      await staffRepo.create({
        full_name: 'Disabled',
        email,
        password_hash: await passwordUtil.hash('Password123!'),
        role_id: role.id,
        preferred_language: 'en',
        is_active: false,
      });
      const res = await request(app)
        .post('/admin/api/v1/auth/login')
        .send({ email, password: 'Password123!' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
    });

    it('rate-limits after 5 failed attempts (SEC-005)', async () => {
      const email = `rl-${Date.now()}@test.local`;
      const role = await staffRepo.findRoleByName('platform_admin');
      await staffRepo.create({
        full_name: 'Rate Limit',
        email,
        password_hash: await passwordUtil.hash('Password123!'),
        role_id: role.id,
        preferred_language: 'en',
        is_active: true,
      });

      for (let i = 0; i < 5; i++) {
        const r = await request(app)
          .post('/admin/api/v1/auth/login')
          .send({ email, password: 'wrong' });
        expect(r.status).toBe(401);
      }
      const sixth = await request(app)
        .post('/admin/api/v1/auth/login')
        .send({ email, password: 'wrong' });
      expect(sixth.status).toBe(403);
      expect(sixth.body.error.code).toBe('RATE_LIMITED');
    });
  });

  describe('POST /admin/api/v1/auth/refresh (answers.md §D)', () => {
    it('issues a new access token + rotated refresh token', async () => {
      const { refreshToken } = await loginStaff('super_admin');
      const res = await request(app)
        .post('/admin/api/v1/auth/refresh')
        .send({ refreshToken });
      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeTruthy();
      expect(res.body.data.refreshToken).toBeTruthy();
      expect(res.body.data.refreshToken).not.toBe(refreshToken); // rotated
    });

    it('rejects a reused (already-rotated) refresh token (INVALID_TOKEN)', async () => {
      const { refreshToken } = await loginStaff('super_admin');
      // First refresh succeeds and rotates the token.
      await request(app)
        .post('/admin/api/v1/auth/refresh')
        .send({ refreshToken });
      // Second use of the same (now-revoked) token must fail.
      const res = await request(app)
        .post('/admin/api/v1/auth/refresh')
        .send({ refreshToken });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('rejects a garbage refresh token (INVALID_TOKEN)', async () => {
      const res = await request(app)
        .post('/admin/api/v1/auth/refresh')
        .send({ refreshToken: 'not-a-real-token' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('POST /admin/api/v1/auth/logout (answers.md §D)', () => {
    it('revokes the refresh token so it can no longer be used', async () => {
      const { refreshToken } = await loginStaff('super_admin');
      const res = await request(app)
        .post('/admin/api/v1/auth/logout')
        .send({ refreshToken });
      expect(res.status).toBe(200);
      expect(res.body.data.loggedOut).toBe(true);

      // The revoked token must no longer be usable for refresh.
      const refreshRes = await request(app)
        .post('/admin/api/v1/auth/refresh')
        .send({ refreshToken });
      expect(refreshRes.status).toBe(401);
      expect(refreshRes.body.error.code).toBe('INVALID_TOKEN');
    });

    it('is idempotent — logging out twice returns 200', async () => {
      const { refreshToken } = await loginStaff('super_admin');
      const r1 = await request(app)
        .post('/admin/api/v1/auth/logout')
        .send({ refreshToken });
      const r2 = await request(app)
        .post('/admin/api/v1/auth/logout')
        .send({ refreshToken });
      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
    });
  });

  describe('Router-token binding (SEC-011)', () => {
    it('rejects a user token on /admin/api/v1/* (INVALID_TOKEN_FOR_ROUTER)', async () => {
      const { token: userToken } = await require('./helpers').registerUser({
        telegramId: 4001,
        phone: '+251911000201',
      });
      const res = await request(app)
        .get('/admin/api/v1/dashboard/summary')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN_FOR_ROUTER');
    });

    it('rejects requests without a token on protected admin routes', async () => {
      const res = await request(app).get('/admin/api/v1/dashboard/summary');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });
  });
});
