/**
 * Profile (§6.5) + Interest (§6.4) tests — covers authenticated user routes.
 */
const request = require('supertest');
const { app, registerUser, addInterest } = require('./helpers');
const db = require('./db');

describe('Profile (§6.5) — /me endpoints', () => {
  describe('GET /api/v1/me', () => {
    it('returns the user profile when authenticated', async () => {
      const { user, token } = await registerUser();
      const res = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.userId).toBe(user.id);
      expect(res.body.data.bank).toBe('Commercial Bank of Ethiopia');
      expect(res.body.data.region).toBe('Oromia');
      expect(res.body.data.zone).toBe('East Shewa');
      expect(res.body.data.branchName).toBe('Adama Main Branch');
      expect(res.body.data.grade.gradeNumber).toBe(7);
    });

    it('returns 401 without a token', async () => {
      const res = await request(app).get('/api/v1/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('rejects a staff token on /api/v1 (SEC-011 router-token binding)', async () => {
      const { loginStaff } = require('./helpers');
      const { token: staffToken } = await loginStaff('super_admin');
      const res = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN_FOR_ROUTER');
    });
  });

  describe('PUT /api/v1/me', () => {
    it('updates branch name and neighborhood', async () => {
      const { token } = await registerUser();
      const res = await request(app)
        .put('/api/v1/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ branchName: 'Adama Main Branch 2', neighborhood: 'Near the roundabout' });
      expect(res.status).toBe(200);
      expect(res.body.data.updated).toBe(true);
    });

    it('updates grade', async () => {
      const { token, user, refs } = await registerUser();
      const res = await request(app)
        .put('/api/v1/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ gradeId: refs.grades[8].id });
      expect(res.status).toBe(200);
      const updated = await db('users').where({ id: user.id }).first();
      expect(updated.grade_id).toBe(refs.grades[8].id);
    });

    it('updates preferred language', async () => {
      const { token, user } = await registerUser();
      const res = await request(app)
        .put('/api/v1/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ preferredLanguage: 'am' });
      expect(res.status).toBe(200);
      const updated = await db('users').where({ id: user.id }).first();
      expect(updated.preferred_language).toBe('am');
    });

    it('rejects an invalid language (VALIDATION_FAILED)', async () => {
      const { token } = await registerUser();
      const res = await request(app)
        .put('/api/v1/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ preferredLanguage: 'fr' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('rejects a zone that does not match the region (ZONE_REGION_MISMATCH)', async () => {
      const { token, refs } = await registerUser();
      const res = await request(app)
        .put('/api/v1/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ regionId: refs.regions['Oromia'].id, zoneId: refs.zones['North Gondar'].id });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('ZONE_REGION_MISMATCH');
    });

    it('rejects attempts to change bank (BANK_CHANGE_UNSUPPORTED)', async () => {
      const { token } = await registerUser();
      const res = await request(app)
        .put('/api/v1/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ bankId: 2 });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('BANK_CHANGE_UNSUPPORTED');
    });
  });
});

describe('Interests (§6.4) — /interests endpoints', () => {
  describe('GET /api/v1/interests/zone-options', () => {
    it('returns the user’s home region with all zones unselected by default', async () => {
      const { user } = await registerUser();
      const res = await request(app)
        .get('/api/v1/interests/zone-options')
        .query({ telegramId: user.telegram_id });
      expect(res.status).toBe(200);
      expect(res.body.data.region.name).toBe('Oromia');
      expect(res.body.data.isUserHomeRegion).toBe(true);
      expect(res.body.data.zones.length).toBeGreaterThan(0);
      expect(res.body.data.zones.every((z) => z.selected === false)).toBe(true);
      expect(res.body.data.currentSelectionCount).toBe(0);
    });

    it('returns PROFILE_INCOMPLETE if user is not registered', async () => {
      const res = await request(app)
        .get('/api/v1/interests/zone-options')
        .query({ telegramId: 99999999 });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('PROFILE_INCOMPLETE');
    });
  });

  describe('POST /api/v1/interests/toggle', () => {
    it('toggles a zone on, then off', async () => {
      const { user, token, refs } = await registerUser();
      const regionId = refs.regions['Oromia'].id;
      const zoneId = refs.zones['West Shewa'].id;

      await request(app)
        .get('/api/v1/interests/zone-options')
        .query({ telegramId: user.telegram_id });

      const on = await request(app)
        .post('/api/v1/interests/toggle')
        .set('Authorization', `Bearer ${token}`)
        .send({ telegramId: user.telegram_id, regionId, locationId: zoneId });
      expect(on.status).toBe(200);
      expect(on.body.data.zones.find((z) => z.id === zoneId).selected).toBe(true);
      expect(on.body.data.currentSelectionCount).toBe(1);

      const off = await request(app)
        .post('/api/v1/interests/toggle')
        .set('Authorization', `Bearer ${token}`)
        .send({ telegramId: user.telegram_id, regionId, locationId: zoneId });
      expect(off.body.data.zones.find((z) => z.id === zoneId).selected).toBe(false);
      expect(off.body.data.currentSelectionCount).toBe(0);
    });

    it('rejects a stale callback (STALE_INTERACTION)', async () => {
      const { user, token, refs } = await registerUser();
      const res = await request(app)
        .post('/api/v1/interests/toggle')
        .set('Authorization', `Bearer ${token}`)
        .send({
          telegramId: user.telegram_id,
          regionId: refs.regions['Oromia'].id,
          locationId: refs.zones['West Shewa'].id,
        });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('STALE_INTERACTION');
    });
  });

  describe('POST /api/v1/interests/confirm', () => {
    it('rejects confirm with no selections (NO_SELECTION)', async () => {
      const { token } = await registerUser();
      // Send a valid telegramId but no selections in session.
      const res = await request(app)
        .post('/api/v1/interests/confirm')
        .set('Authorization', `Bearer ${token}`)
        .send({ telegramId: 1 });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('NO_SELECTION');
    });

    it('persists selections and returns createdInterests (idempotent)', async () => {
      const { user, token, refs } = await registerUser();
      const regionId = refs.regions['Oromia'].id;
      const z1 = refs.zones['West Shewa'].id;
      const z2 = refs.zones['Jimma'].id;

      await request(app)
        .get('/api/v1/interests/zone-options')
        .query({ telegramId: user.telegram_id });
      await request(app)
        .post('/api/v1/interests/toggle')
        .set('Authorization', `Bearer ${token}`)
        .send({ telegramId: user.telegram_id, regionId, locationId: z1 });
      await request(app)
        .post('/api/v1/interests/toggle')
        .set('Authorization', `Bearer ${token}`)
        .send({ telegramId: user.telegram_id, regionId, locationId: z2 });

      const res = await request(app)
        .post('/api/v1/interests/confirm')
        .set('Authorization', `Bearer ${token}`)
        .send({ telegramId: user.telegram_id });
      expect(res.status).toBe(200);
      expect(res.body.data.createdInterests).toHaveLength(2);
      expect(res.body.data.totalActiveInterests).toBe(2);
    });
  });

  describe('GET /api/v1/interests/me', () => {
    it('returns the user’s persisted interests', async () => {
      const { user, token, refs } = await registerUser();
      await addInterest(user.id, refs.zones['West Shewa'].id);
      await addInterest(user.id, refs.zones['Jimma'].id);
      const res = await request(app)
        .get('/api/v1/interests/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.interests).toHaveLength(2);
    });
  });

  describe('DELETE /api/v1/interests/:id', () => {
    it('deletes the user’s own interest', async () => {
      const { user, token, refs } = await registerUser();
      const id = await addInterest(user.id, refs.zones['West Shewa'].id);
      const res = await request(app)
        .delete(`/api/v1/interests/${id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.deletedId).toBe(id);
    });

    it('rejects deleting another user’s interest (FORBIDDEN)', async () => {
      const { user: u1, refs } = await registerUser({ phone: '+251911111111' });
      const { token: t2 } = await registerUser({
        telegramId: u1.telegram_id + 100,
        phone: '+251911222222',
      });
      const id = await addInterest(u1.id, refs.zones['West Shewa'].id);
      const res = await request(app)
        .delete(`/api/v1/interests/${id}`)
        .set('Authorization', `Bearer ${t2}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 404 for a non-existent interest', async () => {
      const { token } = await registerUser();
      const res = await request(app)
        .delete('/api/v1/interests/9999999')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
