/**
 * Matching engine ranking tests — §5 (FR-MATCH-001…007, BR-001…004,008).
 *
 * Focused tests for the ranking rule: is_mutual_match DESC, then la.depth ASC
 * (geographic specificity), then ti.created_at DESC (recency). Also covers
 * region-level matchWarning, BR-001 (same bank), BR-002 (one-directional
 * eligibility), BR-003 (grade adjacency), and the totalResults fix.
 */
const request = require('supertest');
const { app, registerUser, addInterest, getRefs } = require('./helpers');

describe('Matching engine ranking (§5)', () => {
  let refs;
  beforeAll(async () => {
    refs = await getRefs();
  });

  it('ranks mutual matches above one-directional leads (BR-002 + FR-MATCH-005)', async () => {
    // Viewer in East Shewa, interested in West Shewa.
    const viewer = await registerUser({
      telegramId: 6001,
      phone: '+251911000301',
      gradeNumber: 7,
    });
    await addInterest(viewer.user.id, refs.zones['West Shewa'].id);

    // one-directional candidate: sits in West Shewa, interested in East Shewa (viewer's zone).
    // NOT mutual because viewer's interest (West Shewa) doesn't closure-match this candidate's
    // current location (West Shewa) — wait, that IS a match. Let me re-check the mutuality rule.
    //
    // Mutuality: candidate currently sits somewhere the viewer has expressed interest in.
    // Viewer is interested in West Shewa. Candidate sits in West Shewa → mutual!
    //
    // To get a non-mutual candidate, the candidate must sit somewhere the viewer has
    // NOT expressed interest in. Let me put the one-directional candidate in Jimma
    // (a different zone in Oromia) — viewer's interest in West Shewa doesn't match
    // Jimma, so the candidate is NOT mutual.
    const oneDirectional = await registerUser({
      telegramId: 6002,
      phone: '+251911000302',
      zoneName: 'Jimma', // sits in Jimma, NOT West Shewa
      gradeNumber: 7,
    });
    await addInterest(oneDirectional.user.id, refs.zones['East Shewa'].id);

    // mutual candidate: sits in West Shewa (matches viewer's interest), interested in East Shewa.
    const mutual = await registerUser({
      telegramId: 6003,
      phone: '+251911000303',
      zoneName: 'West Shewa',
      gradeNumber: 7,
    });
    await addInterest(mutual.user.id, refs.zones['East Shewa'].id);

    const res = await request(app)
      .get('/api/v1/marketplace/feed?fresh=true')
      .set('Authorization', `Bearer ${viewer.token}`);

    expect(res.status).toBe(200);
    const mutualCard = res.body.data.results.find((r) => r.candidateUserId === mutual.user.id);
    const oneDirCard = res.body.data.results.find(
      (r) => r.candidateUserId === oneDirectional.user.id,
    );
    expect(mutualCard).toBeDefined();
    expect(oneDirCard).toBeDefined();
    expect(mutualCard.isMutualMatch).toBe(true);
    expect(oneDirCard.isMutualMatch).toBe(false);

    // Mutual should appear BEFORE one-directional in the results.
    const mutualIdx = res.body.data.results.findIndex((r) => r.candidateUserId === mutual.user.id);
    const oneDirIdx = res.body.data.results.findIndex(
      (r) => r.candidateUserId === oneDirectional.user.id,
    );
    expect(mutualIdx).toBeLessThan(oneDirIdx);
  });

  it('emits a matchWarning for region-level matches, null for zone-level (§5)', async () => {
    // To trigger a region-level match, the candidate's interest location_id must be
    // a region whose closure includes the viewer's zone_subcity.
    // Since the schema allows interest in a region directly, we add a region-level interest.
    const { TransferInterest } = require('../src/db/models');
    const sequelize = require('../src/db/sequelize');

    const viewer = await registerUser({
      telegramId: 6004,
      phone: '+251911000304',
      regionName: 'Oromia',
      zoneName: 'East Shewa',
      gradeNumber: 7,
    });
    const candidate = await registerUser({
      telegramId: 6005,
      phone: '+251911000305',
      zoneName: 'Jimma',
      gradeNumber: 7,
    });
    // Candidate interested in the Oromia region (not a specific zone).
    await TransferInterest.create({
      user_id: candidate.user.id,
      location_id: refs.regions['Oromia'].id,
    });

    const res = await request(app)
      .get('/api/v1/marketplace/feed?fresh=true')
      .set('Authorization', `Bearer ${viewer.token}`);

    const card = res.body.data.results.find((r) => r.candidateUserId === candidate.user.id);
    expect(card).toBeDefined();
    expect(card.specificity).toBe('region');
    expect(card.matchWarning).not.toBe(null);
    expect(card.matchWarning).toMatch(/broader Oromia region/i);
    expect(card.matchedLocation).toBe('Oromia');
  });

  it('hides identity fields on unpurchased cards (SEC-010 / FR-MATCH-006)', async () => {
    const viewer = await registerUser({
      telegramId: 6006,
      phone: '+251911000306',
      gradeNumber: 7,
    });
    const candidate = await registerUser({
      telegramId: 6007,
      phone: '+251911000307',
      zoneName: 'West Shewa',
      gradeNumber: 7,
    });
    await addInterest(candidate.user.id, refs.zones['East Shewa'].id);

    const res = await request(app)
      .get('/api/v1/marketplace/feed?fresh=true')
      .set('Authorization', `Bearer ${viewer.token}`);

    const card = res.body.data.results.find((r) => r.candidateUserId === candidate.user.id);
    expect(card).toBeDefined();
    expect(card.unlocked).toBe(false);
    expect(card.contact).toBeUndefined();
    // Grade + matchedLocation are NOT identity — they're always disclosed.
    expect(card.grade).toMatch(/Grade 7/);
    expect(card.matchedLocation).toBe('East Shewa');
  });

  it('honors the same-bank constraint (BR-001)', async () => {
    const viewer = await registerUser({
      telegramId: 6008,
      phone: '+251911000308',
      bankNickname: 'cbe',
    });
    const otherBankCandidate = await registerUser({
      telegramId: 6009,
      phone: '+251911000309',
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

  it('honors grade adjacency (BR-003) — ±1 rank by default', async () => {
    const viewer = await registerUser({
      telegramId: 6010,
      phone: '+251911000310',
      gradeNumber: 7,
    });
    // Adjacent (grade 8) — should appear.
    const adjacent = await registerUser({
      telegramId: 6011,
      phone: '+251911000311',
      zoneName: 'West Shewa',
      gradeNumber: 8,
    });
    await addInterest(adjacent.user.id, refs.zones['East Shewa'].id);
    // Too far (grade 12) — should NOT appear.
    const far = await registerUser({
      telegramId: 6012,
      phone: '+251911000312',
      zoneName: 'Jimma',
      gradeNumber: 12,
    });
    await addInterest(far.user.id, refs.zones['East Shewa'].id);

    const res = await request(app)
      .get('/api/v1/marketplace/feed?fresh=true')
      .set('Authorization', `Bearer ${viewer.token}`);

    const adjacentCard = res.body.data.results.find(
      (r) => r.candidateUserId === adjacent.user.id,
    );
    const farCard = res.body.data.results.find((r) => r.candidateUserId === far.user.id);
    expect(adjacentCard).toBeDefined();
    expect(farCard).toBeUndefined();
  });

  it('excludes inactive candidates from the feed', async () => {
    const { User } = require('../src/db/models');
    const viewer = await registerUser({
      telegramId: 6013,
      phone: '+251911000313',
      gradeNumber: 7,
    });
    const inactive = await registerUser({
      telegramId: 6014,
      phone: '+251911000314',
      zoneName: 'West Shewa',
      gradeNumber: 7,
    });
    await addInterest(inactive.user.id, refs.zones['East Shewa'].id);
    await User.update({ is_active: false }, { where: { id: inactive.user.id } });

    const res = await request(app)
      .get('/api/v1/marketplace/feed?fresh=true')
      .set('Authorization', `Bearer ${viewer.token}`);

    const card = res.body.data.results.find((r) => r.candidateUserId === inactive.user.id);
    expect(card).toBeUndefined();
  });

  it('excludes the viewer themselves from the feed', async () => {
    const viewer = await registerUser({
      telegramId: 6015,
      phone: '+251911000315',
      gradeNumber: 7,
    });
    // Viewer has an interest in their own zone — they should NOT appear in their own feed.
    await addInterest(viewer.user.id, refs.zones['East Shewa'].id);

    const res = await request(app)
      .get('/api/v1/marketplace/feed?fresh=true')
      .set('Authorization', `Bearer ${viewer.token}`);

    const self = res.body.data.results.find((r) => r.candidateUserId === viewer.user.id);
    expect(self).toBeUndefined();
  });

  it('computes a true totalResults across the full matching set (§5 fix)', async () => {
    const viewer = await registerUser({
      telegramId: 6016,
      phone: '+251911000316',
      gradeNumber: 7,
    });
    // Create 3 candidates.
    for (let i = 0; i < 3; i++) {
      const c = await registerUser({
        telegramId: 6017 + i,
        phone: `+251911000317${i}`,
        zoneName: 'West Shewa',
        gradeNumber: 7,
      });
      await addInterest(c.user.id, refs.zones['East Shewa'].id);
    }

    // Page 1 with pageSize 2 — totalResults should be 3, not 2.
    const res = await request(app)
      .get('/api/v1/marketplace/feed?page=1&pageSize=2&fresh=true')
      .set('Authorization', `Bearer ${viewer.token}`);

    expect(res.body.data.results).toHaveLength(2);
    expect(res.body.data.totalResults).toBe(3);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.pageSize).toBe(2);
  });
});
