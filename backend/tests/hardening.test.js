// Import Vitest helpers.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// Import HTTP test client.
import request from 'supertest';
// Import Node fs and path.
import fs from 'node:fs';
import path from 'node:path';

// Declare dynamic imports.
let app;
let pool;
let redis;

// Unique test suffix.
const stamp = Date.now().toString().slice(-6);

// Test user.
const telegramId = Number('9700000' + stamp);
let userId;
let token;

// Avatar directory.
const AVATAR_DIR = path.join(process.cwd(), 'storage', 'avatars');

// Setup.
beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';
  process.env.TELEGRAM_BOT_TOKEN = 'dev-test-token';
  process.env.USER_JWT_SECRET = process.env.USER_JWT_SECRET || 'test-user-secret';
  process.env.USER_JWT_EXPIRES_IN = '30d';
  process.env.AVATAR_STORAGE_DIR = AVATAR_DIR;

  const appModule = await import('../src/app.js');
  app = appModule.default;
  const poolModule = await import('../src/db/pool.js');
  pool = poolModule.pool;
  const redisModule = await import('../src/lib/redis.js');
  redis = redisModule.redis;

  // Cleanup.
  await pool.query('DELETE FROM users WHERE telegram_id = ?', [telegramId]);

  // Create a complete test user.
  const [result] = await pool.query(
    'INSERT INTO users (telegram_id, telegram_username, phone_number, bank_id, region_id, zone_id, grade_id, ' +
    'full_name_en, branch_name_en, neighborhood_en, preferred_language, photo_source, is_active, profile_completed_at) ' +
    'VALUES (?, ?, ?, 1, 16, 25, 7, ?, ?, ?, ?, ?, TRUE, NOW())',
    [telegramId, 'harden_' + stamp, '+251970' + stamp, 'Harden User', 'Harden Branch', 'Harden Hood', 'en', 'placeholder']
  );
  userId = result.insertId;

  // Issue token.
  const tokenRes = await request(app).post('/api/v1/auth/issue-token').send({ telegram_id: telegramId });
  token = tokenRes.body.data.token;

  // Ensure avatar directory exists.
  if (!fs.existsSync(AVATAR_DIR)) {
    fs.mkdirSync(AVATAR_DIR, { recursive: true });
  }
});

// Cleanup.
afterAll(async () => {
  // Delete test user's avatar files.
  try {
    const files = fs.readdirSync(AVATAR_DIR);
    for (const file of files) {
      if (file.startsWith(userId + '-')) {
        fs.unlinkSync(path.join(AVATAR_DIR, file));
      }
    }
  } catch {
    // Ignore cleanup errors.
  }

  await pool.query('DELETE FROM users WHERE telegram_id = ?', [telegramId]);
  await pool.end();
  redis.disconnect();
});

// Hardening test suite.
describe('Final Hardening', () => {
  // Test security headers.
  it('returns security headers on responses', async () => {
    const res = await request(app).get('/healthz');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  // Test request ID is unique.
  it('generates unique request IDs', async () => {
    const res1 = await request(app).get('/healthz');
    const res2 = await request(app).get('/healthz');
    expect(res1.headers['x-request-id']).toBeTruthy();
    expect(res2.headers['x-request-id']).toBeTruthy();
    expect(res1.headers['x-request-id']).not.toBe(res2.headers['x-request-id']);
  });

  // Test CORS preflight.
  it('handles CORS preflight', async () => {
    const res = await request(app)
      .options('/api/v1/me')
      .set('Origin', 'http://localhost:5173');
    expect(res.status).toBe(204);
  });

  // Test photo upload with valid JPEG.
  it('uploads a valid JPEG photo', async () => {
    // Create a minimal valid JPEG buffer.
    const jpegBuffer = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9
    ]);

    const res = await request(app)
      .post('/api/v1/me/photo')
      .set('Authorization', 'Bearer ' + token)
      .attach('photo', jpegBuffer, { filename: 'test.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.photo_source).toBe('custom');
    expect(res.body.data.photo_url).toContain('/avatars/');
    expect(res.body.data.photo_url).toContain('-custom-');
  });

  // Test photo upload rejects invalid MIME.
  it('rejects photo upload with invalid MIME type', async () => {
    const textBuffer = Buffer.from('not an image');

    const res = await request(app)
      .post('/api/v1/me/photo')
      .set('Authorization', 'Bearer ' + token)
      .attach('photo', textBuffer, { filename: 'test.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  // Test photo upload rejects oversized file.
  it('rejects photo upload over 5 MB', async () => {
    // Create a 6 MB buffer.
    const bigBuffer = Buffer.alloc(6 * 1024 * 1024, 0xFF);

    const res = await request(app)
      .post('/api/v1/me/photo')
      .set('Authorization', 'Bearer ' + token)
      .attach('photo', bigBuffer, { filename: 'big.jpg', contentType: 'image/jpeg' });

    // Multer rejects with 400 or 500 depending on config.
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  // Test photo delete reverts to placeholder.
  it('deletes custom photo and reverts to placeholder', async () => {
    const res = await request(app)
      .delete('/api/v1/me/photo')
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.photo_source).toBe('placeholder');
    expect(res.body.data.photo_url).toBe(null);
  });

  // Test photo upload requires authentication.
  it('rejects unauthenticated photo upload', async () => {
    const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xD9]);
    const res = await request(app)
      .post('/api/v1/me/photo')
      .attach('photo', jpegBuffer, { filename: 'test.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(401);
  });

  // Test profile reflects custom photo after upload.
  it('profile shows custom photo after upload', async () => {
    // Upload first.
    const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9]);
    await request(app)
      .post('/api/v1/me/photo')
      .set('Authorization', 'Bearer ' + token)
      .attach('photo', jpegBuffer, { filename: 'profile.jpg', contentType: 'image/jpeg' });

    // Check profile.
    const res = await request(app)
      .get('/api/v1/me')
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(res.body.data.photo_source).toBe('custom');
    expect(res.body.data.photo_url).toContain('-custom-');
  });

  // Test completeness reflects custom photo.
  it('completeness shows custom_photo satisfied after upload', async () => {
    const res = await request(app)
      .get('/api/v1/me/completeness')
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(res.body.data.missing_encouraged).not.toContain('custom_photo');
  });

  // Test worker module loads without crashing.
  it('worker module exports are importable', async () => {
    // Just verify the module can be imported without throwing.
    const workerModule = await import('../src/queues/index.js');
    expect(workerModule.getTelegramSendQueue).toBeTypeOf('function');
    expect(workerModule.getNotificationQueue).toBeTypeOf('function');
  });
});
