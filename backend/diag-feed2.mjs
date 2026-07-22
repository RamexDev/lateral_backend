process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.TELEGRAM_BOT_TOKEN = 'dev-test-token';
process.env.USER_JWT_SECRET = process.env.USER_JWT_SECRET || 'test-user-secret';
process.env.USER_JWT_EXPIRES_IN = '30d';

const { default: app } = await import('./src/app.js');
const { pool } = await import('./src/db/pool.js');
const { redis } = await import('./src/lib/redis.js');
const request = (await import('supertest')).default;

const stamp = Date.now().toString().slice(-8);
const viewerTelegramId = Number('93000000' + stamp);
const candidateATelegramId = Number('93000100' + stamp);
const candidateBTelegramId = Number('93000200' + stamp);
const candidateCTelegramId = Number('93000300' + stamp);
const incompleteTelegramId = Number('93000400' + stamp);

const bankId = 1;
const otherBankId = 2;
const viewerRegionId = 16;
const viewerZoneId = 25;
const gradeId7 = 7;
const gradeId8 = 8;
const gradeId4 = 4;

console.log('viewerTelegramId:', viewerTelegramId, 'safe?', Number.isSafeInteger(viewerTelegramId));

// Cleanup
const telegramIds = [viewerTelegramId, candidateATelegramId, candidateBTelegramId, candidateCTelegramId, incompleteTelegramId];
const ph = telegramIds.map(() => '?').join(',');
await pool.query('DELETE FROM transfer_interests WHERE user_id IN (SELECT id FROM users WHERE telegram_id IN (' + ph + '))', telegramIds);
await pool.query('DELETE FROM purchases WHERE buyer_id IN (SELECT id FROM users WHERE telegram_id IN (' + ph + ')) OR target_user_id IN (SELECT id FROM users WHERE telegram_id IN (' + ph + '))', [...telegramIds, ...telegramIds]);
await pool.query('DELETE FROM users WHERE telegram_id IN (' + ph + ')', telegramIds);

async function createTestUser(telegramId, username, phone, bank, region, zone, grade) {
  const [result] = await pool.query(
    'INSERT INTO users (telegram_id,telegram_username,phone_number,bank_id,region_id,zone_id,grade_id,' +
    'full_name_en,branch_name_en,neighborhood_en,preferred_language,photo_source,is_active,profile_completed_at) ' +
    'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,TRUE,NOW())',
    [telegramId, username, phone, bank, region, zone, grade,
     'Test User ' + username, 'Test Branch ' + username, 'Test Neighborhood ' + username, 'en', 'placeholder']
  );
  return result.insertId;
}

async function addInterest(userId, regionId, zoneId) {
  await pool.query('INSERT INTO transfer_interests (user_id,region_id,zone_id) VALUES (?,?,?)',
    [userId, regionId, zoneId === undefined ? null : zoneId]);
}

// Create viewer
const viewerId = await createTestUser(viewerTelegramId, 'viewer_'+stamp, '+251930'+stamp, bankId, viewerRegionId, viewerZoneId, gradeId7);
console.log('viewerId:', viewerId);

// Candidate A: same zone, grade 8
const candidateAId = await createTestUser(candidateATelegramId, 'cand_a_'+stamp, '+251931'+stamp, bankId, viewerRegionId, viewerZoneId, gradeId8);
await addInterest(candidateAId, viewerRegionId, viewerZoneId);

// Candidate B: different zone (26), grade 4, broad region interest
const candidateBId = await createTestUser(candidateBTelegramId, 'cand_b_'+stamp, '+251932'+stamp, bankId, viewerRegionId, 26, gradeId4);
await addInterest(candidateBId, viewerRegionId, null);

// Candidate C: same zone, grade 7
const candidateCId = await createTestUser(candidateCTelegramId, 'cand_c_'+stamp, '+251933'+stamp, bankId, viewerRegionId, viewerZoneId, gradeId7);
await addInterest(candidateCId, viewerRegionId, viewerZoneId);

// Viewer interest (for mutual)
await addInterest(viewerId, viewerRegionId, viewerZoneId);

// Incomplete user
const [incResult] = await pool.query(
  'INSERT INTO users (telegram_id,telegram_username,phone_number,bank_id,region_id,zone_id,preferred_language,photo_source,is_active) VALUES (?,?,?,?,?,?,?,?,TRUE)',
  [incompleteTelegramId, 'incomplete_'+stamp, '+251934'+stamp, bankId, viewerRegionId, viewerZoneId, 'en', 'placeholder']
);
const incompleteUserId = incResult.insertId;

// Issue token
const tokenRes = await request(app).post('/api/v1/auth/issue-token').send({ telegram_id: viewerTelegramId });
console.log('Token status:', tokenRes.status);
const token = tokenRes.body.data ? tokenRes.body.data.token : null;
console.log('Token OK:', !!token);

if (!token) {
  console.log('TOKEN RESPONSE:', JSON.stringify(tokenRes.body, null, 2));
  process.exit(1);
}

// Hit feed
const feedRes = await request(app)
  .get('/api/v1/marketplace/feed?page=1&page_size=10&fresh=true')
  .set('Authorization', 'Bearer ' + token);

console.log('FEED STATUS:', feedRes.status);
console.log('FEED BODY:', JSON.stringify(feedRes.body, null, 2));

// Hit people
const peopleRes = await request(app)
  .get('/api/v1/marketplace/people?page=1&page_size=10')
  .set('Authorization', 'Bearer ' + token);

console.log('PEOPLE STATUS:', peopleRes.status);

// Cleanup
await pool.query('DELETE FROM transfer_interests WHERE user_id IN (SELECT id FROM users WHERE telegram_id IN (' + ph + '))', telegramIds);
await pool.query('DELETE FROM purchases WHERE buyer_id IN (SELECT id FROM users WHERE telegram_id IN (' + ph + ')) OR target_user_id IN (SELECT id FROM users WHERE telegram_id IN (' + ph + '))', [...telegramIds, ...telegramIds]);
await pool.query('DELETE FROM users WHERE telegram_id IN (' + ph + ')', telegramIds);
await pool.end();
redis.disconnect();
process.exit(0);
