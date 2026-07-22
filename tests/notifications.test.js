// Import Vitest helpers.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// Import HTTP test client.
import request from 'supertest';

// Declare dynamic imports.
let app;
let pool;
let redis;

// Unique test suffix.
const stamp = Date.now().toString().slice(-6);

// Test user Telegram IDs (safe integers).
const buyerTelegramId = Number('9500000' + stamp);
const targetTelegramId = Number('9500100' + stamp);

// Seeded reference IDs.
const bankId = 1;
const regionId = 16;
const zoneId = 25;
const gradeId7 = 7;

// User IDs.
let buyerId;
let targetId;

// Auth tokens.
let buyerToken;
let adminToken;

// Helper to create a complete test user.
async function createTestUser(telegramId, username, phone, bank, region, zone, grade) {
  const [result] = await pool.query(
    'INSERT INTO users (' +
    'telegram_id, telegram_username, phone_number, bank_id, region_id, zone_id, grade_id, ' +
    'full_name_en, branch_name_en, neighborhood_en, ' +
    'preferred_language, photo_source, is_active, profile_completed_at' +
    ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW())',
    [
      telegramId, username, phone, bank, region, zone, grade,
      'Test User ' + username, 'Test Branch ' + username, 'Test Neighborhood ' + username,
      'en', 'placeholder'
    ]
  );
  return result.insertId;
}

// Setup before all tests.
beforeAll(async () => {
  // Force test environment.
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';
  process.env.TELEGRAM_BOT_TOKEN = 'dev-test-token';
  process.env.USER_JWT_SECRET = process.env.USER_JWT_SECRET || 'test-user-secret';
  process.env.USER_JWT_EXPIRES_IN = '30d';
  process.env.ADMIN_ACCESS_TOKEN_SECRET = process.env.ADMIN_ACCESS_TOKEN_SECRET || 'test-admin-access-secret';
  process.env.ADMIN_ACCESS_TOKEN_EXPIRES_IN = '15m';
  process.env.ADMIN_REFRESH_TOKEN_EXPIRES_IN = '7d';
  process.env.REVEAL_PRICE_ETB = '500';
  process.env.CHAPA_SECRET_KEY = 'test';

  // Dynamically import app after env overrides.
  const appModule = await import('../src/app.js');
  app = appModule.default;
  const poolModule = await import('../src/db/pool.js');
  pool = poolModule.pool;
  const redisModule = await import('../src/lib/redis.js');
  redis = redisModule.redis;

  // Clean possible leftover test data.
  const telegramIds = [buyerTelegramId, targetTelegramId];
  const ph = telegramIds.map(() => '?').join(',');
  await pool.query('DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE telegram_id IN (' + ph + '))', telegramIds);
  await pool.query('DELETE FROM payments WHERE purchase_id IN (SELECT id FROM purchases WHERE buyer_id IN (SELECT id FROM users WHERE telegram_id IN (' + ph + ')))', telegramIds);
  await pool.query('DELETE FROM purchases WHERE buyer_id IN (SELECT id FROM users WHERE telegram_id IN (' + ph + ')) OR target_user_id IN (SELECT id FROM users WHERE telegram_id IN (' + ph + '))', [...telegramIds, ...telegramIds]);
  await pool.query('DELETE FROM users WHERE telegram_id IN (' + ph + ')', telegramIds);

  // Create buyer.
  buyerId = await createTestUser(buyerTelegramId, 'notif_buyer_' + stamp, '+251950' + stamp, bankId, regionId, zoneId, gradeId7);

  // Create target.
  targetId = await createTestUser(targetTelegramId, 'notif_target_' + stamp, '+251951' + stamp, bankId, regionId, zoneId, gradeId7);

  // Issue buyer token.
  const buyerTokenRes = await request(app).post('/api/v1/auth/issue-token').send({ telegram_id: buyerTelegramId });
  buyerToken = buyerTokenRes.body.data.token;

  // Create admin staff and login.
  const { hash } = await import('@node-rs/bcrypt');
  const adminEmail = 'notif.admin.' + stamp + '@zwuwur.app';
  const adminPassword = 'NotifTestPassword123!';
  const passwordHash = await hash(adminPassword, 10);
  await pool.query(
    'INSERT INTO staff (full_name, email, password_hash, role, preferred_language, is_active) VALUES (?, ?, ?, ?, ?, ?)',
    ['Notif Test Admin', adminEmail, passwordHash, 'admin', 'en', true]
  );
  const adminLoginRes = await request(app)
    .post('/admin/api/v1/auth/login')
    .send({ email: adminEmail, password: adminPassword });
  adminToken = adminLoginRes.body.data.token;

  // Store admin email for cleanup.
  global.__notifAdminEmail = adminEmail;

  // Clear notification rate limits.
  const rlKeys = await redis.keys('rl:notification:*');
  if (rlKeys.length > 0) await redis.del(...rlKeys);
});

// Cleanup after all tests.
afterAll(async () => {
  const telegramIds = [buyerTelegramId, targetTelegramId];
  const ph = telegramIds.map(() => '?').join(',');
  await pool.query('DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE telegram_id IN (' + ph + '))', telegramIds);
  await pool.query('DELETE FROM payments WHERE purchase_id IN (SELECT id FROM purchases WHERE buyer_id IN (SELECT id FROM users WHERE telegram_id IN (' + ph + ')))', telegramIds);
  await pool.query('DELETE FROM purchases WHERE buyer_id IN (SELECT id FROM users WHERE telegram_id IN (' + ph + ')) OR target_user_id IN (SELECT id FROM users WHERE telegram_id IN (' + ph + '))', [...telegramIds, ...telegramIds]);
  await pool.query('DELETE FROM users WHERE telegram_id IN (' + ph + ')', telegramIds);

  // Cleanup admin.
  if (global.__notifAdminEmail) {
    await pool.query('DELETE FROM staff_refresh_tokens WHERE staff_id IN (SELECT id FROM staff WHERE email = ?)', [global.__notifAdminEmail]);
    await pool.query('DELETE FROM staff WHERE email = ?', [global.__notifAdminEmail]);
  }

  const rlKeys = await redis.keys('rl:notification:*');
  if (rlKeys.length > 0) await redis.del(...rlKeys);

  await pool.end();
  redis.disconnect();
});

// Notifications test suite.
describe('Notifications API', () => {
  // Test notification list requires authentication.
  it('rejects unauthenticated notification list request', async () => {
    const res = await request(app).get('/api/v1/notifications/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // Test empty notification list.
  it('returns empty notification list for new user', async () => {
    const res = await request(app)
      .get('/api/v1/notifications/me?page=1&page_size=10')
      .set('Authorization', 'Bearer ' + buyerToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.notifications).toEqual([]);
    expect(res.body.data.total_results).toBe(0);
  });

  // Test payment confirmation notification is created after purchase completion.
  it('creates payment confirmation notification after webhook', async () => {
    // Initiate a purchase.
    const purchaseRes = await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', 'Bearer ' + buyerToken)
      .send({ target_user_id: targetId });

    expect(purchaseRes.status).toBe(201);
    const purchaseId = purchaseRes.body.data.purchase_id;

    // Get the tx_ref for the pending payment.
    const [paymentRows] = await pool.query(
      'SELECT p.tx_ref FROM payments p JOIN purchases pur ON pur.payment_id = p.id WHERE pur.id = ? AND p.status = ?',
      [purchaseId, 'pending']
    );
    const txRef = paymentRows[0].tx_ref;

    // Simulate Chapa webhook.
    const webhookRes = await request(app)
      .post('/api/v1/webhooks/chapa')
      .send({ tx_ref: txRef, status: 'success', amount: 500, currency: 'ETB', reference: 'notif-ref-' + stamp });

    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.data.status).toBe('completed');

    // Check that a payment_confirmation notification was created.
    const notifRes = await request(app)
      .get('/api/v1/notifications/me?page=1&page_size=10')
      .set('Authorization', 'Bearer ' + buyerToken);

    expect(notifRes.status).toBe(200);
    expect(notifRes.body.data.notifications.length).toBeGreaterThanOrEqual(1);

    const paymentNotif = notifRes.body.data.notifications.find((n) => n.type === 'payment_confirmation');
    expect(paymentNotif).toBeTruthy();
    expect(paymentNotif.payload.purchase_id).toBe(purchaseId);
    expect(paymentNotif.payload.amount_etb).toBe(500);
    expect(paymentNotif.payload.summary_en).toContain('Payment confirmed');
  });

  // Test admin broadcast to all users.
  it('sends broadcast to all active users', async () => {
    const res = await request(app)
      .post('/admin/api/v1/notifications/broadcast')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({
        segment_filter: { scope: 'all' },
        message: {
          en: 'System maintenance tonight at 10 PM.',
          am: 'ዛሬ ማታ 10 ሰዓት ላይ የስርዓት ጥገና ይኖራል።'
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.queued_recipients).toBeGreaterThanOrEqual(2);
  });

  // Test broadcast appears in user's notification list.
  it('broadcast notification appears in user list', async () => {
    const res = await request(app)
      .get('/api/v1/notifications/me?page=1&page_size=10')
      .set('Authorization', 'Bearer ' + buyerToken);

    expect(res.status).toBe(200);
    const broadcastNotif = res.body.data.notifications.find((n) => n.type === 'broadcast');
    expect(broadcastNotif).toBeTruthy();
    expect(broadcastNotif.payload.summary_en).toContain('maintenance');
  });

  // Test broadcast with bank segment.
  it('sends broadcast to bank segment', async () => {
    const res = await request(app)
      .post('/admin/api/v1/notifications/broadcast')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({
        segment_filter: { scope: 'bank', bank_id: bankId },
        message: {
          en: 'Bank-specific update.',
          am: 'የባንክ ልዩ ማሻሻያ።'
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.data.queued_recipients).toBeGreaterThanOrEqual(2);
  });

  // Test broadcast with empty segment.
  it('rejects broadcast with empty segment', async () => {
    const res = await request(app)
      .post('/admin/api/v1/notifications/broadcast')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({
        segment_filter: { scope: 'bank', bank_id: 9999 },
        message: {
          en: 'This should fail.',
          am: 'ይህ መውደቅ አለበት።'
        }
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('EMPTY_SEGMENT');
  });

  // Test broadcast requires staff auth.
  it('rejects unauthenticated broadcast', async () => {
    const res = await request(app)
      .post('/admin/api/v1/notifications/broadcast')
      .send({
        segment_filter: { scope: 'all' },
        message: { en: 'Test', am: 'ሙከራ' }
      });

    expect(res.status).toBe(401);
  });

  // Test broadcast validation.
  it('rejects broadcast with missing message', async () => {
    const res = await request(app)
      .post('/admin/api/v1/notifications/broadcast')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({
        segment_filter: { scope: 'all' },
        message: { en: '', am: '' }
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  // Test notification pagination.
  it('paginates notifications correctly', async () => {
    const res = await request(app)
      .get('/api/v1/notifications/me?page=1&page_size=1')
      .set('Authorization', 'Bearer ' + buyerToken);

    expect(res.status).toBe(200);
    expect(res.body.data.notifications.length).toBe(1);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.page_size).toBe(1);
    expect(res.body.data.total_results).toBeGreaterThanOrEqual(2);
  });
});
