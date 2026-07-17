/**
 * Onboarding flow tests — covers the full registration wizard (§6.3) including
 * success scenarios, validation failures, edge cases, and idempotency.
 */
const request = require('supertest');
const { app, registerUser, getRefs } = require('./helpers');
const db = require('./db');

describe('Onboarding wizard (§6.3)', () => {
  let telegramIdCounter = 1000000;
  let refs;

  beforeAll(async () => {
    refs = await getRefs();
  });

  function nextTelegramId() {
    telegramIdCounter += 1;
    return telegramIdCounter;
  }

  describe('POST /api/v1/onboarding/start', () => {
    it('returns the language picker for a brand-new user', async () => {
      const telegramId = nextTelegramId();
      const res = await request(app)
        .post('/api/v1/onboarding/start')
        .send({ telegramId, telegramUsername: 'new_user' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.step).toBe('select_language');
      expect(res.body.data.languages).toEqual([
        { code: 'en', label: 'English' },
        { code: 'am', label: 'አማርኛ' },
      ]);
    });

    it('returns already_registered when the user exists', async () => {
      const { user } = await registerUser({ telegramId: nextTelegramId() });
      const res = await request(app)
        .post('/api/v1/onboarding/start')
        .send({ telegramId: user.telegram_id });

      expect(res.status).toBe(200);
      expect(res.body.data.step).toBe('already_registered');
      expect(res.body.data.userId).toBe(user.id);
    });

    it('validates telegramId is required', async () => {
      const res = await request(app).post('/api/v1/onboarding/start').send({});
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('POST /api/v1/onboarding/language', () => {
    it('accepts en and am', async () => {
      const telegramId = nextTelegramId();
      await request(app).post('/api/v1/onboarding/start').send({ telegramId });

      for (const lang of ['en', 'am']) {
        const res = await request(app)
          .post('/api/v1/onboarding/language')
          .send({ telegramId, language: lang });
        expect(res.status).toBe(200);
        expect(res.body.data.step).toBe('share_contact');
      }
    });

    it('rejects an unsupported language with INVALID_LANGUAGE', async () => {
      const telegramId = nextTelegramId();
      await request(app).post('/api/v1/onboarding/start').send({ telegramId });

      const res = await request(app)
        .post('/api/v1/onboarding/language')
        .send({ telegramId, language: 'or' });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_LANGUAGE');
    });
  });

  describe('POST /api/v1/onboarding/contact', () => {
    it('rejects a contact that does not belong to the user (CONTACT_NOT_SELF)', async () => {
      const telegramId = nextTelegramId();
      await request(app).post('/api/v1/onboarding/start').send({ telegramId });
      await request(app).post('/api/v1/onboarding/language').send({ telegramId, language: 'en' });

      const res = await request(app).post('/api/v1/onboarding/contact').send({
        telegramId,
        telegramUsername: 'tester',
        phoneNumber: '+251911223344',
        contactIsSelf: false,
      });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('CONTACT_NOT_SELF');
    });

    it('proceeds to bank selection on valid contact share', async () => {
      const telegramId = nextTelegramId();
      await request(app).post('/api/v1/onboarding/start').send({ telegramId });
      await request(app).post('/api/v1/onboarding/language').send({ telegramId, language: 'en' });

      const res = await request(app).post('/api/v1/onboarding/contact').send({
        telegramId,
        telegramUsername: 'tester',
        phoneNumber: '+251911223344',
        contactIsSelf: true,
      });
      expect(res.status).toBe(200);
      expect(res.body.data.step).toBe('select_bank');
      expect(Array.isArray(res.body.data.banks)).toBe(true);
      expect(res.body.data.banks.length).toBeGreaterThan(0);
    });

    it('warns when no Telegram username is set (still proceeds)', async () => {
      const telegramId = nextTelegramId();
      await request(app).post('/api/v1/onboarding/start').send({ telegramId });
      await request(app).post('/api/v1/onboarding/language').send({ telegramId, language: 'en' });

      const res = await request(app).post('/api/v1/onboarding/contact').send({
        telegramId,
        telegramUsername: null,
        phoneNumber: '+251911555666',
        contactIsSelf: true,
      });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/username/i);
    });
  });

  describe('POST /api/v1/onboarding/bank', () => {
    it('rejects an invalid bank with BANK_NOT_FOUND', async () => {
      const telegramId = nextTelegramId();
      await registerToContact(telegramId);
      const res = await request(app)
        .post('/api/v1/onboarding/bank')
        .send({ telegramId, bankId: 999999 });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('BANK_NOT_FOUND');
    });
  });

  describe('POST /api/v1/onboarding/zone', () => {
    it('rejects a zone that does not belong to the selected region (ZONE_REGION_MISMATCH)', async () => {
      const telegramId = nextTelegramId();
      await registerToContact(telegramId);
      await request(app)
        .post('/api/v1/onboarding/bank')
        .send({ telegramId, bankId: refs.banks.cbe.id });
      await request(app)
        .post('/api/v1/onboarding/region')
        .send({ telegramId, regionId: refs.regions['Oromia'].id });
      // Use a zone from a different region (Amhara).
      const res = await request(app)
        .post('/api/v1/onboarding/zone')
        .send({ telegramId, zoneId: refs.zones['North Gondar'].id });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('ZONE_REGION_MISMATCH');
    });
  });

  describe('POST /api/v1/onboarding/branch-details', () => {
    it('rejects a too-short branch name (INVALID_BRANCH_NAME)', async () => {
      const telegramId = nextTelegramId();
      await registerToZone(telegramId);
      const res = await request(app)
        .post('/api/v1/onboarding/branch-details')
        .send({ telegramId, branchName: 'AB' });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_BRANCH_NAME');
    });
  });

  describe('POST /api/v1/onboarding/grade', () => {
    it('rejects a grade from a different band (GRADE_BAND_MISMATCH)', async () => {
      const telegramId = nextTelegramId();
      await registerToBranchDetails(telegramId);
      // Pick the 6-9 band, then try to confirm with grade 11 (which is in the 10-12 band).
      await request(app)
        .post('/api/v1/onboarding/grade-band')
        .send({ telegramId, bandLabel: refs.grades[6].band_label });
      const res = await request(app)
        .post('/api/v1/onboarding/grade')
        .send({ telegramId, gradeId: refs.grades[11].id });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('GRADE_BAND_MISMATCH');
    });

    it('creates a user profile on success', async () => {
      const telegramId = nextTelegramId();
      const { user } = await registerUser({ telegramId });
      expect(user).toBeTruthy();
      expect(user.id).toBeGreaterThan(0);
      expect(user.is_active).toBe(1);
      expect(user.preferred_language).toBe('en');

      const row = await db('users').where({ id: user.id }).first();
      expect(row.branch_name).toBe('Adama Main Branch');
    });

    it('rejects a duplicate phone under the same bank with a different telegram id (DUPLICATE_PHONE)', async () => {
      const phone = '+251911444555';
      const first = await registerUser({ telegramId: nextTelegramId(), phone });
      const telegramId2 = nextTelegramId();
      await registerToContact(telegramId2, { phone });
      await request(app)
        .post('/api/v1/onboarding/bank')
        .send({ telegramId: telegramId2, bankId: first.user.bank_id });
      await request(app)
        .post('/api/v1/onboarding/region')
        .send({ telegramId: telegramId2, regionId: refs.regions['Oromia'].id });
      await request(app)
        .post('/api/v1/onboarding/zone')
        .send({ telegramId: telegramId2, zoneId: refs.zones['East Shewa'].id });
      await request(app)
        .post('/api/v1/onboarding/branch-details')
        .send({ telegramId: telegramId2, branchName: 'Other Branch', neighborhood: 'X' });
      await request(app)
        .post('/api/v1/onboarding/grade-band')
        .send({ telegramId: telegramId2, bandLabel: refs.grades[6].band_label });
      const res = await request(app)
        .post('/api/v1/onboarding/grade')
        .send({ telegramId: telegramId2, gradeId: refs.grades[7].id });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('DUPLICATE_PHONE');
    });
  });

  // ─── Helpers that walk the wizard up to a given step ─────────────────────────

  async function registerToContact(telegramId, opts = {}) {
    await request(app).post('/api/v1/onboarding/start').send({ telegramId });
    await request(app).post('/api/v1/onboarding/language').send({ telegramId, language: 'en' });
    await request(app)
      .post('/api/v1/onboarding/contact')
      .send({
        telegramId,
        telegramUsername: 'tester',
        phoneNumber: opts.phone || '+251911000000',
        contactIsSelf: true,
      });
  }

  async function registerToZone(telegramId) {
    await registerToContact(telegramId);
    await request(app)
      .post('/api/v1/onboarding/bank')
      .send({ telegramId, bankId: refs.banks.cbe.id });
    await request(app)
      .post('/api/v1/onboarding/region')
      .send({ telegramId, regionId: refs.regions['Oromia'].id });
  }

  async function registerToBranchDetails(telegramId) {
    await registerToZone(telegramId);
    await request(app)
      .post('/api/v1/onboarding/zone')
      .send({ telegramId, zoneId: refs.zones['East Shewa'].id });
  }
});
