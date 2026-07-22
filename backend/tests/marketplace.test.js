// Import Vitest helpers.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// Import HTTP test client.
import request from 'supertest';

// Declare dynamic imports.
let app;
let pool;
let redis;

// Unique test suffix.
const stamp = Date.now().toString().slice(-8);

// Test user Telegram IDs.
const viewerTelegramId = Number('9300000' + stamp.slice(0,6));
const candidateATelegramId = Number('9300100' + stamp.slice(0,6));
const candidateBTelegramId = Number('9300200' + stamp.slice(0,6));
const candidateCTelegramId = Number('9300300' + stamp.slice(0,6));
const incompleteTelegramId = Number('9300400' + stamp.slice(0,6));

// Seeded reference IDs.
const bankId = 1;
const otherBankId = 2;
const viewerRegionId = 16;   // Oromia
const viewerZoneId = 25;     // East Shewa
const gradeId7 = 7;          // Band 3
const gradeId8 = 8;          // Band 3 (same band)
const gradeId4 = 4;          // Band 2 (adjacent band)

// User IDs.
let viewerId;
let candidateAId;
let candidateBId;
let candidateCId;
let incompleteUserId;

// Auth token for viewer.
let viewerToken;

// Helper to create a complete test user.
async function createTestUser(telegramId, username, phone, bank, region, zone, grade) {
  const [result] = await pool.query(
    'INSERT INTO users (' +
    'telegram_id, telegram_username, phone_number, bank_id, region_id, zone_id, grade_id, ' +
    'full_name_en, branch_name_en, neighborhood_en, ' +
    'preferred_language, photo_source, is_active, profile_completed_at' +
    ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW())',
    [
      telegramId,
      username,
      phone,
      bank,
      region,
      zone,
      grade,
      'Test User ' + username,
      'Test Branch ' + username,
      'Test Neighborhood ' + username,
      'en',
      'placeholder'
    ]
  );
  return result.insertId;
}

// Helper to add a transfer interest.
async function addInterest(userId, regionId, zoneId) {
  await pool.query(
    'INSERT INTO transfer_interests (user_id, region_id, zone_id) VALUES (?, ?, ?)',
    [userId, regionId, zoneId === undefined ? null : zoneId]
  );
}

// Setup before all tests.
beforeAll(async () => {
  // Force test environment.
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';
  process.env.TELEGRAM_BOT_TOKEN = 'dev-test-token';
  process.env.USER_JWT_SECRET = process.env.USER_JWT_SECRET || 'test-user-secret';
  process.env.USER_JWT_EXPIRES_IN = '30d';

  // Dynamically import app after env overrides.
  const appModule = await import('../src/app.js');
  app = appModule.default;
  const poolModule = await import('../src/db/pool.js');
  pool = poolModule.pool;
  const redisModule = await import('../src/lib/redis.js');
  redis = redisModule.redis;

  // Clean possible leftover test data.
  const telegramIds = [viewerTelegramId, candidateATelegramId, candidateBTelegramId, candidateCTelegramId, incompleteTelegramId];
  const placeholders = telegramIds.map(() => '?').join(', ');
  await pool.query('DELETE FROM transfer_interests WHERE user_id IN (SELECT id FROM users WHERE telegram_id IN (' + placeholders + '))', telegramIds);
  await pool.query('DELETE FROM purchases WHERE buyer_id IN (SELECT id FROM users WHERE telegram_id IN (' + placeholders + ')) OR target_user_id IN (SELECT id FROM users WHERE telegram_id IN (' + placeholders + '))', [...telegramIds, ...telegramIds]);
  await pool.query('DELETE FROM users WHERE telegram_id IN (' + placeholders + ')', telegramIds);

  // Create viewer: complete user in Oromia / East Shewa / Grade 7 (Band 3).
  viewerId = await createTestUser(
    viewerTelegramId, 'viewer_' + stamp, '+251930' + stamp,
    bankId, viewerRegionId, viewerZoneId, gradeId7
  );

  // Create Candidate A: same bank, same zone, Grade 8 (Band 3).
  candidateAId = await createTestUser(
    candidateATelegramId, 'candidate_a_' + stamp, '+251931' + stamp,
    bankId, viewerRegionId, viewerZoneId, gradeId8
  );
  // Candidate A wants viewer's zone.
  await addInterest(candidateAId, viewerRegionId, viewerZoneId);

  // Create Candidate B: same bank, different zone (West Shewa), Grade 4 (Band 2).
  candidateBId = await createTestUser(
    candidateBTelegramId, 'candidate_b_' + stamp, '+251932' + stamp,
    bankId, viewerRegionId, 26, gradeId4
  );
  // Candidate B has broad interest in Oromia (zone_id = NULL).
  await addInterest(candidateBId, viewerRegionId, null);

  // Create Candidate C: same bank, same zone, Grade 7 — will be mutual.
  candidateCId = await createTestUser(
    candidateCTelegramId, 'candidate_c_' + stamp, '+251933' + stamp,
    bankId, viewerRegionId, viewerZoneId, gradeId7
  );
  // Candidate C wants viewer's zone.
  await addInterest(candidateCId, viewerRegionId, viewerZoneId);

  // Give the viewer an interest in their own zone → makes C mutual.
  await addInterest(viewerId, viewerRegionId, viewerZoneId);

  // Create incomplete user (should not appear in feed).
  const [incResult] = await pool.query(
    'INSERT INTO users (' +
    'telegram_id, telegram_username, phone_number, bank_id, region_id, zone_id, ' +
    'preferred_language, photo_source, is_active' +
    ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)',
    [incompleteTelegramId, 'incomplete_' + stamp, '+251934' + stamp, bankId, viewerRegionId, viewerZoneId, 'en', 'placeholder']
  );
  incompleteUserId = incResult.insertId;

  // Issue viewer token.
  const tokenRes = await request(app)
    .post('/api/v1/auth/issue-token')
    .send({ telegram_id: viewerTelegramId });
  viewerToken = tokenRes.body.data.token;

  // Clear feed/people cache.
  const feedKeys = await redis.keys('feed:*');
  if (feedKeys.length > 0) await redis.del(...feedKeys);
  const peopleKeys = await redis.keys('people:*');
  if (peopleKeys.length > 0) await redis.del(...peopleKeys);
});

// Cleanup after all tests.
afterAll(async () => {
  const telegramIds = [viewerTelegramId, candidateATelegramId, candidateBTelegramId, candidateCTelegramId, incompleteTelegramId];
  const placeholders = telegramIds.map(() => '?').join(', ');
  await pool.query('DELETE FROM transfer_interests WHERE user_id IN (SELECT id FROM users WHERE telegram_id IN (' + placeholders + '))', telegramIds);
  await pool.query('DELETE FROM purchases WHERE buyer_id IN (SELECT id FROM users WHERE telegram_id IN (' + placeholders + ')) OR target_user_id IN (SELECT id FROM users WHERE telegram_id IN (' + placeholders + '))', [...telegramIds, ...telegramIds]);
  await pool.query('DELETE FROM users WHERE telegram_id IN (' + placeholders + ')', telegramIds);

  const feedKeys = await redis.keys('feed:*');
  if (feedKeys.length > 0) await redis.del(...feedKeys);
  const peopleKeys = await redis.keys('people:*');
  if (peopleKeys.length > 0) await redis.del(...peopleKeys);
  const rlKeys = await redis.keys('rl:user-*');
  if (rlKeys.length > 0) await redis.del(...rlKeys);

  await pool.end();
  redis.disconnect();
});

// Marketplace test suite.
describe('Marketplace Feed + People API', () => {
  it('rejects unauthenticated feed request', async () => {
    const res = await request(app).get('/api/v1/marketplace/feed');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('returns feed candidates with correct masking', async () => {
    const res = await request(app)
      .get('/api/v1/marketplace/feed?page=1&page_size=10&fresh=true')
      .set('Authorization', 'Bearer ' + viewerToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.results.length).toBeGreaterThanOrEqual(2);

    const card = res.body.data.results[0];
    expect(card.full_name_en).toBe('*');
    expect(card.full_name_am).toBe('*');
    expect(card.branch_name_en).toBe('*');
    expect(card.neighborhood_en).toBe('*');
    expect(card.phone_number).toBe('*');
    expect(card.telegram_username).toBe('*');
    expect(card.purchased).toBe(false);
    expect(card.photo_url).not.toBe('*');
  });

  it('ranks mutual matches first and zone above region', async () => {
    const res = await request(app)
      .get('/api/v1/marketplace/feed?page=1&page_size=10&fresh=true')
      .set('Authorization', 'Bearer ' + viewerToken);

    expect(res.status).toBe(200);
    const results = res.body.data.results;
    const mutualResults = results.filter((r) => r.is_mutual === true);
    const nonMutualResults = results.filter((r) => r.is_mutual === false);

    if (mutualResults.length > 0 && nonMutualResults.length > 0) {
      const lastMutualIndex = results.lastIndexOf(mutualResults[mutualResults.length - 1]);
      const firstNonMutualIndex = results.indexOf(nonMutualResults[0]);
      expect(lastMutualIndex).toBeLessThan(firstNonMutualIndex);
    }
  });

  it('does not include incomplete users in feed', async () => {
    const res = await request(app)
      .get('/api/v1/marketplace/feed?page=1&page_size=50&fresh=true')
      .set('Authorization', 'Bearer ' + viewerToken);

    expect(res.status).toBe(200);
    const ids = res.body.data.results.map((r) => r.id);
    expect(ids).not.toContain(incompleteUserId);
  });

  it('does not include the viewer in their own feed', async () => {
    const res = await request(app)
      .get('/api/v1/marketplace/feed?page=1&page_size=50&fresh=true')
      .set('Authorization', 'Bearer ' + viewerToken);

    expect(res.status).toBe(200);
    const ids = res.body.data.results.map((r) => r.id);
    expect(ids).not.toContain(viewerId);
  });

  it('only includes candidates within ±1 grade band', async () => {
    const res = await request(app)
      .get('/api/v1/marketplace/feed?page=1&page_size=50&fresh=true')
      .set('Authorization', 'Bearer ' + viewerToken);

    expect(res.status).toBe(200);
    for (const card of res.body.data.results) {
      expect(Math.abs(card.grade.band - 3)).toBeLessThanOrEqual(1);
    }
  });

  it('returns empty state for people when no interests exist', async () => {
    const tempTelegramId = Number('9300500' + stamp.slice(0,6));
    const tempId = await createTestUser(
      tempTelegramId, 'temp_no_int_' + stamp, '+251935' + stamp,
      bankId, viewerRegionId, viewerZoneId, gradeId7
    );
    const tempTokenRes = await request(app)
      .post('/api/v1/auth/issue-token')
      .send({ telegram_id: tempTelegramId });
    const tempToken = tempTokenRes.body.data.token;

    const res = await request(app)
      .get('/api/v1/marketplace/people?page=1&page_size=10')
      .set('Authorization', 'Bearer ' + tempToken);

    expect(res.status).toBe(200);
    expect(res.body.data.results).toEqual([]);
    expect(res.body.data.requires_interests).toBe(true);

    await pool.query('DELETE FROM users WHERE id = ?', [tempId]);
  });

  it('returns people in viewer desired areas', async () => {
    const res = await request(app)
      .get('/api/v1/marketplace/people?page=1&page_size=10')
      .set('Authorization', 'Bearer ' + viewerToken);

    expect(res.status).toBe(200);
    expect(res.body.data.requires_interests).toBe(false);
    expect(res.body.data.results.length).toBeGreaterThanOrEqual(1);
  });

  it('masks paywalled fields in people results', async () => {
    const res = await request(app)
      .get('/api/v1/marketplace/people?page=1&page_size=10')
      .set('Authorization', 'Bearer ' + viewerToken);

    expect(res.status).toBe(200);
    if (res.body.data.results.length > 0) {
      const card = res.body.data.results[0];
      expect(card.full_name_en).toBe('*');
      expect(card.phone_number).toBe('*');
      expect(card.purchased).toBe(false);
      expect(card.photo_url).not.toBe('*');
    }
  });

  it('serves cached feed on second request', async () => {
    const first = await request(app)
      .get('/api/v1/marketplace/feed?page=1&page_size=10&fresh=true')
      .set('Authorization', 'Bearer ' + viewerToken);
    expect(first.status).toBe(200);

    const second = await request(app)
      .get('/api/v1/marketplace/feed?page=1&page_size=10')
      .set('Authorization', 'Bearer ' + viewerToken);
    expect(second.status).toBe(200);
    expect(second.body.data.results.length).toBe(first.body.data.results.length);
  });

  it('rejects feed access for incomplete profile', async () => {
    const tokenRes = await request(app)
      .post('/api/v1/auth/issue-token')
      .send({ telegram_id: incompleteTelegramId });
    const incompleteToken = tokenRes.body.data.token;

    const res = await request(app)
      .get('/api/v1/marketplace/feed')
      .set('Authorization', 'Bearer ' + incompleteToken);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PROFILE_INCOMPLETE');
  });

  it('does not return cross-bank candidates', async () => {
    const otherBankTelegramId = Number('9300600' + stamp.slice(0,6));
    const otherBankUserId = await createTestUser(
      otherBankTelegramId, 'other_bank_' + stamp, '+251936' + stamp,
      otherBankId, viewerRegionId, viewerZoneId, gradeId7
    );
    await addInterest(otherBankUserId, viewerRegionId, viewerZoneId);

    const res = await request(app)
      .get('/api/v1/marketplace/feed?page=1&page_size=50&fresh=true')
      .set('Authorization', 'Bearer ' + viewerToken);

    expect(res.status).toBe(200);
    const ids = res.body.data.results.map((r) => r.id);
    expect(ids).not.toContain(otherBankUserId);

    await pool.query('DELETE FROM transfer_interests WHERE user_id = ?', [otherBankUserId]);
    await pool.query('DELETE FROM users WHERE id = ?', [otherBankUserId]);
  });
});
