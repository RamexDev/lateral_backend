// Import Vitest helpers.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Import HTTP test client.
import request from 'supertest';

// Import bcrypt for creating test staff/users.
import { hash } from '@node-rs/bcrypt';

// Declare dynamic imports.
let app;
let pool;
let redis;

// Unique test suffix.
const stamp = Date.now().toString().slice(-8);

// Test user Telegram ID and phone.
const telegramId = Number('92000000' + stamp);
const phone = '+251920' + stamp;

// Test user ID and token.
let userId;
let token;

// Seeded reference IDs.
const bankId = 1;
const homeRegionId = 16;
const homeZoneId = 25;
const gradeId = 7;

// Other regions/zones for testing.
const regionAmhara = 41;
const regionTigray = 55;
const regionSomali = 63;
const zoneAmhara1 = 42;
const zoneAmhara2 = 43;
const zoneAmhara3 = 44;
const zoneAmhara4 = 45;
const zoneTigray1 = 56;

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

  // Clean possible leftover test user.
  await pool.query('DELETE FROM transfer_interests WHERE user_id IN (SELECT id FROM users WHERE telegram_id = ?)', [telegramId]);
  await pool.query('DELETE FROM users WHERE telegram_id = ?', [telegramId]);

  // Create a complete test user.
  const [result] = await pool.query(
    'INSERT INTO users (' +
    'telegram_id, telegram_username, phone_number, bank_id, region_id, zone_id, grade_id, ' +
    'full_name_en, branch_name_en, neighborhood_en, ' +
    'preferred_language, photo_source, is_active, profile_completed_at' +
    ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW())',
    [
      telegramId,
      'interest_test_' + stamp,
      phone,
      bankId,
      homeRegionId,
      homeZoneId,
      gradeId,
      'Interest Test User',
      'Test Branch',
      'Test Neighborhood',
      'en',
      'placeholder'
    ]
  );

  userId = result.insertId;

  // Issue a user token via the internal helper.
  const tokenRes = await request(app)
    .post('/api/v1/auth/issue-token')
    .send({ telegram_id: telegramId });

  token = tokenRes.body.data.token;
});

// Cleanup after all tests.
afterAll(async () => {
  // Delete test interests and user.
  await pool.query('DELETE FROM transfer_interests WHERE user_id = ?', [userId]);
  await pool.query('DELETE FROM users WHERE id = ?', [userId]);

  // Close MySQL pool.
  await pool.end();

  // Close Redis connection.
  redis.disconnect();
});

// Transfer interests test suite.
describe('Transfer Interests API', () => {
  // Test saving valid interests.
  it('saves interests with zone and broad region', async () => {
    const res = await request(app)
      .put('/api/v1/interests/me')
      .set('Authorization', 'Bearer ' + token)
      .send({
        interests: [
          { region_id: homeRegionId, zone_id: homeZoneId },
          { region_id: regionAmhara, zone_id: null }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.saved).toBe(true);
    expect(res.body.data.total_active_interests).toBe(2);
  });

  // Test getting interests.
  it('returns saved interests with names', async () => {
    const res = await request(app)
      .get('/api/v1/interests/me')
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.interests.length).toBe(2);
    expect(res.body.data.selected_region_count).toBe(2);

    // Check that names are populated.
    const zoneInterest = res.body.data.interests.find((i) => i.zone_id !== null);
    expect(zoneInterest.region_name).toBeTruthy();
    expect(zoneInterest.zone_name).toBeTruthy();

    const broadInterest = res.body.data.interests.find((i) => i.zone_id === null);
    expect(broadInterest.region_name).toBeTruthy();
    expect(broadInterest.zone_id).toBe(null);
  });

  // Test options endpoint defaults to home region.
  it('returns options for home region by default', async () => {
    const res = await request(app)
      .get('/api/v1/interests/options')
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.region.id).toBe(homeRegionId);
    expect(res.body.data.is_user_home_region).toBe(true);
    expect(res.body.data.zones.length).toBeGreaterThan(0);
    expect(res.body.data.limits.max_regions).toBe(3);
    expect(res.body.data.limits.max_zones_per_region).toBe(3);
  });

  // Test options endpoint with explicit region.
  it('returns options for a specific region with selected state', async () => {
    const res = await request(app)
      .get('/api/v1/interests/options?region_id=' + homeRegionId)
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.region.id).toBe(homeRegionId);

    // The home zone should be marked as selected.
    const homeZone = res.body.data.zones.find((z) => z.id === homeZoneId);
    expect(homeZone).toBeTruthy();
    expect(homeZone.selected).toBe(true);
  });

  // Test diff preserves created_at for unchanged interests.
  it('preserves created_at for unchanged interests during diff', async () => {
    // Get current interests and record created_at.
    const beforeRes = await request(app)
      .get('/api/v1/interests/me')
      .set('Authorization', 'Bearer ' + token);

    const beforeInterest = beforeRes.body.data.interests.find((i) => i.zone_id === homeZoneId);
    const beforeCreatedAt = beforeInterest.created_at;

    // Save again with the same interests plus one new one.
    await request(app)
      .put('/api/v1/interests/me')
      .set('Authorization', 'Bearer ' + token)
      .send({
        interests: [
          { region_id: homeRegionId, zone_id: homeZoneId },
          { region_id: regionAmhara, zone_id: null },
          { region_id: regionTigray, zone_id: zoneTigray1 }
        ]
      });

    // Get interests again.
    const afterRes = await request(app)
      .get('/api/v1/interests/me')
      .set('Authorization', 'Bearer ' + token);

    const afterInterest = afterRes.body.data.interests.find((i) => i.zone_id === homeZoneId);

    // created_at should be preserved for the unchanged interest.
    expect(afterInterest.created_at).toBe(beforeCreatedAt);

    // Total should now be 3.
    expect(afterRes.body.data.interests.length).toBe(3);
  });

  // Test exceeding max regions.
  it('rejects more than 3 regions', async () => {
    const res = await request(app)
      .put('/api/v1/interests/me')
      .set('Authorization', 'Bearer ' + token)
      .send({
        interests: [
          { region_id: homeRegionId, zone_id: homeZoneId },
          { region_id: regionAmhara, zone_id: null },
          { region_id: regionTigray, zone_id: zoneTigray1 },
          { region_id: regionSomali, zone_id: null }
        ]
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INTEREST_LIMIT_EXCEEDED');
  });

  // Test exceeding max zones per region.
  it('rejects more than 3 zones per region', async () => {
    const res = await request(app)
      .put('/api/v1/interests/me')
      .set('Authorization', 'Bearer ' + token)
      .send({
        interests: [
          { region_id: regionAmhara, zone_id: zoneAmhara1 },
          { region_id: regionAmhara, zone_id: zoneAmhara2 },
          { region_id: regionAmhara, zone_id: zoneAmhara3 },
          { region_id: regionAmhara, zone_id: zoneAmhara4 }
        ]
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INTEREST_LIMIT_EXCEEDED');
  });

  // Test zone-region mismatch.
  it('rejects zone that does not belong to region', async () => {
    const res = await request(app)
      .put('/api/v1/interests/me')
      .set('Authorization', 'Bearer ' + token)
      .send({
        interests: [
          { region_id: regionAmhara, zone_id: homeZoneId }
        ]
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ZONE_REGION_MISMATCH');
  });

  // Test broad with zones not allowed.
  it('rejects broad interest combined with zone interests for same region', async () => {
    const res = await request(app)
      .put('/api/v1/interests/me')
      .set('Authorization', 'Bearer ' + token)
      .send({
        interests: [
          { region_id: regionAmhara, zone_id: null },
          { region_id: regionAmhara, zone_id: zoneAmhara1 }
        ]
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('BROAD_WITH_ZONES_NOT_ALLOWED');
  });

  // Test deleting a single interest.
  it('deletes a single interest by ID', async () => {
    // First get current interests.
    const listRes = await request(app)
      .get('/api/v1/interests/me')
      .set('Authorization', 'Bearer ' + token);

    const interestToDelete = listRes.body.data.interests[0];
    const countBefore = listRes.body.data.interests.length;

    // Delete it.
    const deleteRes = await request(app)
      .delete('/api/v1/interests/' + interestToDelete.id)
      .set('Authorization', 'Bearer ' + token);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);
    expect(deleteRes.body.data.deleted_id).toBe(interestToDelete.id);

    // Verify count decreased.
    const afterRes = await request(app)
      .get('/api/v1/interests/me')
      .set('Authorization', 'Bearer ' + token);

    expect(afterRes.body.data.interests.length).toBe(countBefore - 1);
  });

  // Test deleting another user's interest returns 404.
  it('rejects deleting an interest that does not belong to the user', async () => {
    const res = await request(app)
      .delete('/api/v1/interests/999999')
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  // Test clearing all interests with empty array.
  it('clears all interests with empty array', async () => {
    const res = await request(app)
      .put('/api/v1/interests/me')
      .set('Authorization', 'Bearer ' + token)
      .send({ interests: [] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.saved).toBe(true);
    expect(res.body.data.total_active_interests).toBe(0);

    // Verify empty.
    const listRes = await request(app)
      .get('/api/v1/interests/me')
      .set('Authorization', 'Bearer ' + token);

    expect(listRes.body.data.interests.length).toBe(0);
    expect(listRes.body.data.selected_region_count).toBe(0);
  });

  // Test unauthenticated access.
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/v1/interests/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });
});
