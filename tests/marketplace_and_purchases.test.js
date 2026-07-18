/**
 * Marketplace feed + purchases tests (§6.6, §6.7).
 * Covers: matching engine, SEC-010 contact hiding, BR-006 no-double-charge,
 * payment webhook idempotency.
 */
const request = require('supertest');
const { app, registerUser, addInterest, getRefs } = require('./helpers');
const { User, Payment } = require('../src/db/models');

describe('Marketplace feed (§6.6) — /marketplace/feed', () => {
  let refs;
  beforeAll(async () => {
    refs = await getRefs();
  });

  it('returns no matches when no candidates have an interest in the viewer’s zone', async () => {
    const { token } = await registerUser({ phone: '+251911000001' });
    const res = await request(app)
      .get('/api/v1/marketplace/feed')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.results).toEqual([]);
    expect(res.body.data.totalResults).toBe(0);
    expect(res.body.message).toMatch(/No matches yet/i);
  });

  it('returns a candidate when their interest matches the viewer’s zone', async () => {
    const viewer = await registerUser({
      telegramId: 2001,
      phone: '+251911000011',
      gradeNumber: 7,
    });

    const candidate = await registerUser({
      telegramId: 2002,
      phone: '+251911000012',
      zoneName: 'West Shewa',
      gradeNumber: 7,
    });
    await addInterest(candidate.user.id, refs.zones['East Shewa'].id);

    const res = await request(app)
      .get('/api/v1/marketplace/feed?fresh=true')
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.results.length).toBeGreaterThan(0);

    const card = res.body.data.results.find((r) => r.candidateUserId === candidate.user.id);
    expect(card).toBeDefined();
    expect(card.unlocked).toBe(false);
    expect(card.grade).toMatch(/Grade 7/);
    expect(card.matchedLocation).toBe('East Shewa');
    expect(card.specificity).toBe('zone_subcity');
    expect(card.isMutualMatch).toBe(false);
    expect(card.contact).toBeUndefined();
  });

  it('marks isMutualMatch=true when the candidate also sits somewhere the viewer is interested in', async () => {
    const viewer = await registerUser({
      telegramId: 2003,
      phone: '+251911000021',
      gradeNumber: 7,
    });
    await addInterest(viewer.user.id, refs.zones['West Shewa'].id);

    const candidate = await registerUser({
      telegramId: 2004,
      phone: '+251911000022',
      zoneName: 'West Shewa',
      gradeNumber: 7,
    });
    await addInterest(candidate.user.id, refs.zones['East Shewa'].id);

    const res = await request(app)
      .get('/api/v1/marketplace/feed?fresh=true')
      .set('Authorization', `Bearer ${viewer.token}`);
    const card = res.body.data.results.find((r) => r.candidateUserId === candidate.user.id);
    expect(card).toBeDefined();
    expect(card.isMutualMatch).toBe(true);
  });

  it('does not include candidates from a different bank (BR-001)', async () => {
    const viewer = await registerUser({
      telegramId: 2005,
      phone: '+251911000031',
      bankNickname: 'cbe',
    });
    const otherBankCandidate = await registerUser({
      telegramId: 2006,
      phone: '+251911000032',
      bankNickname: 'awash',
      zoneName: 'West Shewa',
    });
    await addInterest(otherBankCandidate.user.id, refs.zones['East Shewa'].id);

    const res = await request(app)
      .get('/api/v1/marketplace/feed?fresh=true')
      .set('Authorization', `Bearer ${viewer.token}`);
    const card = res.body.data.results.find(
      (r) => r.candidateUserId === otherBankCandidate.user.id,
    );
    expect(card).toBeUndefined();
  });

  it('does not include candidates outside the grade adjacency range (BR-003)', async () => {
    const viewer = await registerUser({
      telegramId: 2007,
      phone: '+251911000041',
      gradeNumber: 7,
    });
    const farCandidate = await registerUser({
      telegramId: 2008,
      phone: '+251911000042',
      gradeNumber: 12,
      zoneName: 'West Shewa',
    });
    await addInterest(farCandidate.user.id, refs.zones['East Shewa'].id);

    const res = await request(app)
      .get('/api/v1/marketplace/feed?fresh=true')
      .set('Authorization', `Bearer ${viewer.token}`);
    const card = res.body.data.results.find((r) => r.candidateUserId === farCandidate.user.id);
    expect(card).toBeUndefined();
  });

  it('honors ?fresh=true to bypass the cache (FR-MATCH-007)', async () => {
    const viewer = await registerUser({
      telegramId: 2009,
      phone: '+251911000051',
      gradeNumber: 7,
    });
    const r1 = await request(app)
      .get('/api/v1/marketplace/feed?fresh=true')
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(r1.body.data.totalResults).toBe(0);

    const candidate = await registerUser({
      telegramId: 2010,
      phone: '+251911000052',
      zoneName: 'West Shewa',
      gradeNumber: 7,
    });
    await addInterest(candidate.user.id, refs.zones['East Shewa'].id);

    const r2 = await request(app)
      .get('/api/v1/marketplace/feed?fresh=true')
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(r2.body.data.totalResults).toBeGreaterThan(0);
  });
});

describe('Purchases (§6.7) — /purchases + payments webhook', () => {
  let refs;
  beforeAll(async () => {
    refs = await getRefs();
  });

  it('initiates a purchase and returns an invoice link', async () => {
    const buyer = await registerUser({
      telegramId: 3001,
      phone: '+251911000101',
    });
    const target = await registerUser({
      telegramId: 3002,
      phone: '+251911000102',
      zoneName: 'West Shewa',
    });

    const res = await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ targetUserId: target.user.id });
    expect(res.status).toBe(200);
    expect(res.body.data.purchaseId).toBeGreaterThan(0);
    expect(res.body.data.paymentId).toBeGreaterThan(0);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.checkoutUrl).toMatch(/^https:\/\/checkout\.chapa\.co\//);
  });

  it('rejects a duplicate purchase (BR-006 ALREADY_PURCHASED)', async () => {
    const buyer = await registerUser({
      telegramId: 3003,
      phone: '+251911000103',
    });
    const target = await registerUser({
      telegramId: 3004,
      phone: '+251911000104',
      zoneName: 'West Shewa',
    });

    await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ targetUserId: target.user.id });

    const second = await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ targetUserId: target.user.id });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ALREADY_PURCHASED');
  });

  it('rejects a purchase of an inactive target (TARGET_INACTIVE)', async () => {
    const buyer = await registerUser({
      telegramId: 3005,
      phone: '+251911000105',
    });
    const target = await registerUser({
      telegramId: 3006,
      phone: '+251911000106',
      zoneName: 'West Shewa',
    });
    await User.update({ is_active: false }, { where: { id: target.user.id } });

    const res = await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ targetUserId: target.user.id });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('TARGET_INACTIVE');
  });

  it('completes the purchase on successful_payment webhook and reveals contact in feed', async () => {
    const buyer = await registerUser({
      telegramId: 3007,
      phone: '+251911000107',
    });
    const target = await registerUser({
      telegramId: 3008,
      phone: '+251911000108',
      zoneName: 'West Shewa',
    });
    // Target has an interest in buyer's zone so they appear in the feed.
    await addInterest(target.user.id, refs.zones['East Shewa'].id);

    const purchase = await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ targetUserId: target.user.id });

    const webhookRes = await request(app)
      .post('/api/v1/webhooks/chapa')
      .send({
        event: 'charge.success',
        data: {
          tx_ref: `purchase:${purchase.body.data.purchaseId}`,
          amount: '500',
          currency: 'ETB',
          status: 'success',
          reference: `chapa-ref-test-${purchase.body.data.purchaseId}`,
        },
      });
    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.ok).toBe(true);

    const feed = await request(app)
      .get('/api/v1/marketplace/feed?fresh=true')
      .set('Authorization', `Bearer ${buyer.token}`);
    const card = feed.body.data.results.find((r) => r.candidateUserId === target.user.id);
    expect(card).toBeDefined();
    expect(card.unlocked).toBe(true);
    expect(card.contact).toBeDefined();
    expect(card.contact.phone).toBe('+251911000108');
    expect(card.contact.branchName).toBe('Adama Main Branch');
  });

  it('is idempotent on duplicate successful_payment webhook delivery (FR-PAY-002)', async () => {
    const buyer = await registerUser({
      telegramId: 3009,
      phone: '+251911000109',
    });
    const target = await registerUser({
      telegramId: 3010,
      phone: '+251911000110',
      zoneName: 'West Shewa',
    });
    const purchase = await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ targetUserId: target.user.id });

    const payload = {
      event: 'charge.success',
      data: {
        tx_ref: `purchase:${purchase.body.data.purchaseId}`,
        amount: '500',
        currency: 'ETB',
        status: 'success',
        reference: `chapa-ref-dup-${purchase.body.data.purchaseId}`,
      },
    };
    await request(app).post('/api/v1/webhooks/chapa').send(payload);
    const second = await request(app).post('/api/v1/webhooks/chapa').send(payload);

    expect(second.status).toBe(200);
    expect(second.body.ok).toBe(true);

    const payments = await Payment.findAll({
      where: { provider_charge_id: `purchase:${purchase.body.data.purchaseId}` },
      raw: true,
    });
    expect(payments).toHaveLength(1);
    expect(payments[0].status).toBe('completed');
  });

  it('lists the buyer’s purchases with status (§6.7 GET /me/purchases)', async () => {
    const buyer = await registerUser({
      telegramId: 3011,
      phone: '+251911000111',
    });
    const target = await registerUser({
      telegramId: 3012,
      phone: '+251911000112',
      zoneName: 'West Shewa',
    });
    const purchase = await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ targetUserId: target.user.id });

    const res = await request(app)
      .get('/api/v1/me/purchases')
      .set('Authorization', `Bearer ${buyer.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.purchases).toHaveLength(1);
    expect(res.body.data.purchases[0].purchaseId).toBe(purchase.body.data.purchaseId);
    expect(res.body.data.purchases[0].status).toBe('pending');
  });
});
