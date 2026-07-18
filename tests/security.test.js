/**
 * Security tests — SEC-003 (initData), SEC-004 (RBAC), SEC-005 (login rate limit),
 * SEC-007 (webhook integrity), SEC-008 (API rate limiting), SEC-011 (router-scope),
 * BR-006 (purchase double-charge guard — both mutex + DB constraint).
 */
const request = require('supertest');
const crypto = require('crypto');
const { app, registerUser, loginStaff, getRefs } = require('./helpers');
const { verifyInitData } = require('../src/utils/telegramInitData');
const { requireRole, Roles, Capabilities } = require('../src/middlewares/rbac');

describe('SEC-003 — Telegram initData verification', () => {
  it('verifies a correctly-signed initData payload', () => {
    // Use a known bot token + compute the expected hash.
    const botToken = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
    const userPayload = JSON.stringify({ id: 987654321, username: 'tester', first_name: 'Test' });
    const params = {
      query_id: 'query_123',
      user: userPayload,
      auth_date: '1690000000',
    };

    // Compute the expected hash per Telegram's algorithm.
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const dataCheckString = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('\n');
    const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const initData = Object.entries({ ...params, hash })
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    const result = verifyInitData(initData, botToken);
    expect(result.ok).toBe(true);
    expect(result.user.id).toBe(987654321);
    expect(result.user.username).toBe('tester');
  });

  it('rejects an initData with a tampered hash', () => {
    const botToken = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
    const params = { query_id: 'q', user: JSON.stringify({ id: 1 }), auth_date: '1' };
    const initData =
      Object.entries({ ...params, hash: 'deadbeef'.repeat(8) })
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
    const result = verifyInitData(initData, botToken);
    expect(result.ok).toBe(false);
  });

  it('rejects an initData missing the hash param', () => {
    const botToken = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
    const initData = 'query_id=q&user=' + encodeURIComponent(JSON.stringify({ id: 1 }));
    const result = verifyInitData(initData, botToken);
    expect(result.ok).toBe(false);
  });

  it('returns ok=false when no bot token is configured (fail closed)', () => {
    const initData = 'query_id=q&hash=' + '0'.repeat(64);
    const result = verifyInitData(initData, ''); // empty botToken
    expect(result.ok).toBe(false);
  });
});

describe('SEC-008 — API rate limiting on feed + purchases', () => {
  let refs;
  beforeAll(async () => {
    refs = await getRefs();
  });

  it('returns 403 RATE_LIMITED after exceeding the feed rate limit', async () => {
    const { token } = await registerUser({
      telegramId: 7001,
      phone: '+251911000401',
    });

    // Feed limiter: 60 req / 60s. Fire 65 requests, expect the last few to be 403.
    const statuses = [];
    for (let i = 0; i < 65; i++) {
      const res = await request(app)
        .get('/api/v1/marketplace/feed?fresh=true')
        .set('Authorization', `Bearer ${token}`);
      statuses.push(res.status);
      if (res.status === 403) break; // got limited — stop early
    }
    expect(statuses).toContain(403);
  });

  it('returns 403 RATE_LIMITED after exceeding the purchase rate limit', async () => {
    const buyer = await registerUser({
      telegramId: 7002,
      phone: '+251911000402',
    });
    const target = await registerUser({
      telegramId: 7003,
      phone: '+251911000403',
      zoneName: 'West Shewa',
    });

    // Purchase limiter: 10 req / 60s. Each purchase fails on the 2nd (ALREADY_PURCHASED 409),
    // but the limiter counts the attempt. Fire 12 attempts.
    const statuses = [];
    for (let i = 0; i < 12; i++) {
      const res = await request(app)
        .post('/api/v1/purchases')
        .set('Authorization', `Bearer ${buyer.token}`)
        .send({ targetUserId: target.user.id });
      statuses.push(res.status);
      if (res.status === 403 && res.body?.error?.code === 'RATE_LIMITED') break;
    }
    expect(statuses).toContain(403);
  });
});

describe('SEC-004 — RBAC middleware', () => {
  describe('requireRole(...allowedRoles)', () => {
    it('calls next() when the staff role is in the allowed list', () => {
      const middleware = requireRole(Roles.SUPER_ADMIN, Roles.PLATFORM_ADMIN);
      const req = { authPayload: { roleName: Roles.PLATFORM_ADMIN } };
      const next = jest.fn();
      middleware(req, {}, next);
      expect(next).toHaveBeenCalledWith(/* no error */);
    });

    it('returns INSUFFICIENT_ROLE when the staff role is not allowed', () => {
      const middleware = requireRole(Roles.SUPER_ADMIN, Roles.PLATFORM_ADMIN);
      const req = { authPayload: { roleName: Roles.FINANCE_OFFICER } };
      const next = jest.fn();
      middleware(req, { status: () => ({ json: () => {} }) }, next);
      const err = next.mock.calls[0][0];
      expect(err).toBeDefined();
      expect(err.code).toBe('INSUFFICIENT_ROLE');
      expect(err.status).toBe(403);
    });

    it('returns INVALID_TOKEN when no roleName is set', () => {
      const middleware = requireRole(Roles.SUPER_ADMIN);
      const req = { authPayload: {} };
      const next = jest.fn();
      middleware(req, {}, next);
      const err = next.mock.calls[0][0];
      expect(err.code).toBe('INVALID_TOKEN');
      expect(err.status).toBe(401);
    });
  });

  describe('Capabilities matrix (§11)', () => {
    it('manageReferenceData = super_admin + platform_admin', () => {
      expect(Capabilities.manageReferenceData).toEqual(
        expect.arrayContaining([Roles.SUPER_ADMIN, Roles.PLATFORM_ADMIN]),
      );
      expect(Capabilities.manageReferenceData).not.toContain(Roles.FINANCE_OFFICER);
      expect(Capabilities.manageReferenceData).not.toContain(Roles.SUPPORT_OFFICER);
    });

    it('manageStaff = super_admin only', () => {
      expect(Capabilities.manageStaff).toEqual([Roles.SUPER_ADMIN]);
    });

    it('viewRevenueReports = super_admin + finance_officer', () => {
      expect(Capabilities.viewRevenueReports).toEqual(
        expect.arrayContaining([Roles.SUPER_ADMIN, Roles.FINANCE_OFFICER]),
      );
      expect(Capabilities.viewRevenueReports).not.toContain(Roles.PLATFORM_ADMIN);
    });

    it('manageUserStatus includes support_officer', () => {
      expect(Capabilities.manageUserStatus).toContain(Roles.SUPPORT_OFFICER);
    });
  });
});

describe('SEC-011 — Router-scope enforcement', () => {
  it('rejects a user token on /admin/api/v1/*', async () => {
    const { token: userToken } = await registerUser({
      telegramId: 7101,
      phone: '+251911000501',
    });
    const res = await request(app)
      .get('/admin/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN_FOR_ROUTER');
  });

  it('rejects a staff token on /api/v1/*', async () => {
    const { token: staffToken } = await loginStaff('super_admin');
    const res = await request(app)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN_FOR_ROUTER');
  });
});

describe('BR-006 — Purchase double-charge guard', () => {
  let refs;
  beforeAll(async () => {
    refs = await getRefs();
  });

  it('rejects a second purchase of the same target with ALREADY_PURCHASED (409)', async () => {
    const buyer = await registerUser({
      telegramId: 7201,
      phone: '+251911000601',
    });
    const target = await registerUser({
      telegramId: 7202,
      phone: '+251911000602',
      zoneName: 'West Shewa',
    });

    const first = await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ targetUserId: target.user.id });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ targetUserId: target.user.id });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ALREADY_PURCHASED');
  });

  it('the cache mutex is released after the first purchase so a re-attempt returns ALREADY_PURCHASED (not a stale lock)', async () => {
    const buyer = await registerUser({
      telegramId: 7203,
      phone: '+251911000603',
    });
    const target = await registerUser({
      telegramId: 7204,
      phone: '+251911000604',
      zoneName: 'West Shewa',
    });

    await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ targetUserId: target.user.id });

    // The mutex should have been released in the finally block.
    const { getBackend } = require('../src/utils/cache');
    const cache = await getBackend();
    const lockKey = `lock:purchase:${buyer.user.id}:${target.user.id}`;
    const lockValue = await cache.get(lockKey);
    expect(lockValue).toBeNull();
  });
});

describe('SEC-007 — Webhook integrity (Chapa payments webhook)', () => {
  it('rejects a webhook with the wrong Chapa-Signature when configured', async () => {
    const originalSecret = process.env.CHAPA_WEBHOOK_SECRET;
    process.env.CHAPA_WEBHOOK_SECRET = 'test-secret-xyz';

    try {
      const res = await request(app)
        .post('/api/v1/webhooks/chapa')
        .set('chapa-signature', 'deadbeef')
        .send({ event: 'charge.success', data: { tx_ref: 'purchase:1', status: 'success' } });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    } finally {
      if (originalSecret === undefined) delete process.env.CHAPA_WEBHOOK_SECRET;
      else process.env.CHAPA_WEBHOOK_SECRET = originalSecret;
    }
  });

  it('accepts a webhook with the correct Chapa-Signature', async () => {
    const crypto = require('crypto');
    const originalSecret = process.env.CHAPA_WEBHOOK_SECRET;
    process.env.CHAPA_WEBHOOK_SECRET = 'test-secret-correct';

    try {
      const body = { event: 'unknown.event', data: {} };
      const rawBody = JSON.stringify(body);
      const signature = crypto
        .createHmac('sha256', 'test-secret-correct')
        .update(rawBody)
        .digest('hex');

      const res = await request(app)
        .post('/api/v1/webhooks/chapa')
        .set('chapa-signature', signature)
        .set('Content-Type', 'application/json')
        .send(rawBody);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    } finally {
      if (originalSecret === undefined) delete process.env.CHAPA_WEBHOOK_SECRET;
      else process.env.CHAPA_WEBHOOK_SECRET = originalSecret;
    }
  });
});
