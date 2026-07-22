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
const buyerTelegramId = Number('9400000' + stamp);
const targetTelegramId = Number('9400100' + stamp);
const otherBankTelegramId = Number('9400200' + stamp);
const incompleteTelegramId = Number('9400300' + stamp);

// Seeded reference IDs.
const bankId = 1;
const otherBankId = 2;
const regionId = 16;   // Oromia
const zoneId = 25;     // East Shewa
const gradeId7 = 7;    // Band 3

// User IDs.
let buyerId;
let targetId;
let otherBankUserId;
let incompleteUserId;

// Auth tokens.
let buyerToken;
let targetToken;

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

// Cleanup helper: delete payments BEFORE purchases (FK constraint).
async function cleanupTestData() {
  const telegramIds = [buyerTelegramId, targetTelegramId, otherBankTelegramId, incompleteTelegramId];
  const ph = telegramIds.map(() => '?').join(',');
  // Delete payments first (FK: payments.purchase_id → purchases.id).
  await pool.query(
    'DELETE FROM payments WHERE purchase_id IN (SELECT id FROM purchases WHERE buyer_id IN (SELECT id FROM users WHERE telegram_id IN (' + ph + ')) OR target_user_id IN (SELECT id FROM users WHERE telegram_id IN (' + ph + ')))',
    [...telegramIds, ...telegramIds]
  );
  // Then delete purchases.
  await pool.query(
    'DELETE FROM purchases WHERE buyer_id IN (SELECT id FROM users WHERE telegram_id IN (' + ph + ')) OR target_user_id IN (SELECT id FROM users WHERE telegram_id IN (' + ph + '))',
    [...telegramIds, ...telegramIds]
  );
  // Then delete interests.
  await pool.query(
    'DELETE FROM transfer_interests WHERE user_id IN (SELECT id FROM users WHERE telegram_id IN (' + ph + '))',
    telegramIds
  );
  // Then delete users.
  await pool.query('DELETE FROM users WHERE telegram_id IN (' + ph + ')', telegramIds);
}

// Setup before all tests.
beforeAll(async () => {
  // Force test environment.
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';
  process.env.TELEGRAM_BOT_TOKEN = 'dev-test-token';
  process.env.USER_JWT_SECRET = process.env.USER_JWT_SECRET || 'test-user-secret';
  process.env.USER_JWT_EXPIRES_IN = '30d';
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
  await cleanupTestData();

  // Create buyer.
  buyerId = await createTestUser(buyerTelegramId, 'buyer_' + stamp, '+251940' + stamp, bankId, regionId, zoneId, gradeId7);

  // Create target (same bank).
  targetId = await createTestUser(targetTelegramId, 'target_' + stamp, '+251941' + stamp, bankId, regionId, zoneId, gradeId7);

  // Create other-bank user.
  otherBankUserId = await createTestUser(otherBankTelegramId, 'otherbank_' + stamp, '+251942' + stamp, otherBankId, regionId, zoneId, gradeId7);

  // Create incomplete user.
  const [incResult] = await pool.query(
    'INSERT INTO users (telegram_id, telegram_username, phone_number, bank_id, region_id, zone_id, preferred_language, photo_source, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)',
    [incompleteTelegramId, 'incomplete_' + stamp, '+251943' + stamp, bankId, regionId, zoneId, 'en', 'placeholder']
  );
  incompleteUserId = incResult.insertId;

  // Issue tokens.
  const buyerTokenRes = await request(app).post('/api/v1/auth/issue-token').send({ telegram_id: buyerTelegramId });
  buyerToken = buyerTokenRes.body.data.token;

  const targetTokenRes = await request(app).post('/api/v1/auth/issue-token').send({ telegram_id: targetTelegramId });
  targetToken = targetTokenRes.body.data.token;

  // Clear rate limit keys.
  const rlKeys = await redis.keys('rl:purchase:*');
  if (rlKeys.length > 0) await redis.del(...rlKeys);
  const lockKeys = await redis.keys('lock:purchase:*');
  if (lockKeys.length > 0) await redis.del(...lockKeys);
});

// Cleanup after all tests.
afterAll(async () => {
  await cleanupTestData();

  const rlKeys = await redis.keys('rl:purchase:*');
  if (rlKeys.length > 0) await redis.del(...rlKeys);
  const lockKeys = await redis.keys('lock:purchase:*');
  if (lockKeys.length > 0) await redis.del(...lockKeys);

  await pool.end();
  redis.disconnect();
});

// Purchases test suite.
describe('Purchases + Payments API', () => {
  // Test purchase requires authentication.
  it('rejects unauthenticated purchase request', async () => {
    const res = await request(app)
      .post('/api/v1/purchases')
      .send({ target_user_id: targetId });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // Test successful purchase initiation.
  it('initiates a purchase and returns checkout URL', async () => {
    const res = await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', 'Bearer ' + buyerToken)
      .send({ target_user_id: targetId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.purchase_id).toBeTruthy();
    expect(res.body.data.checkout_url).toBeTruthy();
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.already_exists).toBe(false);
  });

  // Test duplicate purchase returns existing.
  it('returns existing purchase for duplicate request', async () => {
    const res = await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', 'Bearer ' + buyerToken)
      .send({ target_user_id: targetId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.already_exists).toBe(true);
    expect(res.body.data.status).toBe('pending');
  });

  // Test self-purchase rejection.
  it('rejects self-purchase', async () => {
    const res = await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', 'Bearer ' + buyerToken)
      .send({ target_user_id: buyerId });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SELF_PURCHASE');
  });

  // Test cross-bank purchase rejection.
  it('rejects cross-bank purchase', async () => {
    const res = await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', 'Bearer ' + buyerToken)
      .send({ target_user_id: otherBankUserId });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CROSS_BANK');
  });

  // Test incomplete profile rejection.
  it('rejects purchase from incomplete profile', async () => {
    const incTokenRes = await request(app).post('/api/v1/auth/issue-token').send({ telegram_id: incompleteTelegramId });
    const incToken = incTokenRes.body.data.token;

    const res = await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', 'Bearer ' + incToken)
      .send({ target_user_id: targetId });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PROFILE_INCOMPLETE');
  });

  // Test Chapa webhook completes purchase.
  it('completes purchase via Chapa webhook', async () => {
    // Get the tx_ref for the pending payment via the purchases table.
    const [paymentRows] = await pool.query(
      'SELECT p.tx_ref FROM payments p JOIN purchases pur ON pur.payment_id = p.id WHERE pur.buyer_id = ? AND p.status = ? ORDER BY p.id DESC LIMIT 1',
      [buyerId, 'pending']
    );
    expect(paymentRows.length).toBeGreaterThan(0);
    const txRef = paymentRows[0].tx_ref;

    // Simulate Chapa webhook.
    const res = await request(app)
      .post('/api/v1/webhooks/chapa')
      .send({
        tx_ref: txRef,
        status: 'success',
        amount: 500,
        currency: 'ETB',
        reference: 'chapa-ref-' + stamp
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.purchase_updated).toBe(true);
    expect(res.body.data.duplicate_ignored).toBe(false);
  });

  // Test webhook idempotency (duplicate delivery).
  it('handles duplicate webhook delivery idempotently', async () => {
    // Get the tx_ref for the completed payment.
    const [paymentRows] = await pool.query(
      'SELECT p.tx_ref FROM payments p JOIN purchases pur ON pur.payment_id = p.id WHERE pur.buyer_id = ? AND p.status = ? ORDER BY p.id DESC LIMIT 1',
      [buyerId, 'completed']
    );
    expect(paymentRows.length).toBeGreaterThan(0);
    const txRef = paymentRows[0].tx_ref;

    // Send the same webhook again.
    const res = await request(app)
      .post('/api/v1/webhooks/chapa')
      .send({
        tx_ref: txRef,
        status: 'success',
        amount: 500,
        currency: 'ETB',
        reference: 'chapa-ref-' + stamp
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.duplicate_ignored).toBe(true);
  });

  // Test purchase history shows completed purchase with full contact.
  it('returns purchase history with full contact details', async () => {
    const res = await request(app)
      .get('/api/v1/purchases/me?page=1&page_size=10')
      .set('Authorization', 'Bearer ' + buyerToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.results.length).toBe(1);
    expect(res.body.data.total_results).toBe(1);

    const purchase = res.body.data.results[0];
    expect(purchase.target.id).toBe(targetId);
    // Full contact revealed (not masked).
    expect(purchase.target.full_name_en).not.toBe('*');
    expect(purchase.target.phone_number).not.toBe('*');
    expect(purchase.target.telegram_username).not.toBe('*');
    expect(purchase.target.full_name_en).toContain('Test User');
  });

  // Test feed now shows revealed contact for purchased candidate.
  it('feed shows full contact for purchased candidate', async () => {
    // Give target an interest in buyer's zone so they appear in feed.
    await pool.query('INSERT INTO transfer_interests (user_id, region_id, zone_id) VALUES (?, ?, ?)', [targetId, regionId, zoneId]);

    const res = await request(app)
      .get('/api/v1/marketplace/feed?page=1&page_size=50&fresh=true')
      .set('Authorization', 'Bearer ' + buyerToken);

    expect(res.status).toBe(200);
    const targetCard = res.body.data.results.find((r) => r.id === targetId);
    expect(targetCard).toBeTruthy();
    expect(targetCard.purchased).toBe(true);
    expect(targetCard.full_name_en).not.toBe('*');
    expect(targetCard.phone_number).not.toBe('*');
    expect(targetCard.telegram_username).not.toBe('*');

    // Cleanup interest.
    await pool.query('DELETE FROM transfer_interests WHERE user_id = ?', [targetId]);
  });

  // Test webhook with failed payment.
  // Test webhook with failed payment.
  it('handles failed payment webhook', async () => {
    // Use otherBankUserId as target to avoid uq_buyer_target conflict.
    const [failPurRes] = await pool.query(
      'INSERT INTO purchases (buyer_id, target_user_id, payment_id, status) VALUES (?, ?, NULL, ?)',
      [buyerId, otherBankUserId, 'pending']
    );
    const failPurchaseId = failPurRes.insertId;

    // Create a pending payment with correct column names.
    const txRef = 'zwuwur-fail-' + stamp;
    await pool.query(
      'INSERT INTO payments (purchase_id, provider, provider_charge_id, tx_ref, amount, currency, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [failPurchaseId, 'chapa', txRef, txRef, 500, 'ETB', 'pending']
    );

    const res = await request(app)
      .post('/api/v1/webhooks/chapa')
      .send({
        tx_ref: txRef,
        status: 'failed',
        amount: 500,
        currency: 'ETB'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('failed');

    // Cleanup the failed purchase.
    await pool.query('DELETE FROM payments WHERE purchase_id = ?', [failPurchaseId]);
    await pool.query('DELETE FROM purchases WHERE id = ?', [failPurchaseId]);
  });

  // Test webhook with unknown tx_ref.
  it('rejects webhook with unknown tx_ref', async () => {
    const res = await request(app)
      .post('/api/v1/webhooks/chapa')
      .send({
        tx_ref: 'unknown-tx-ref-' + stamp,
        status: 'success',
        amount: 500
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PAYMENT_NOT_FOUND');
  });

  // Test purchase list requires authentication.
  it('rejects unauthenticated purchase list request', async () => {
    const res = await request(app).get('/api/v1/purchases/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
