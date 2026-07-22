process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.TELEGRAM_BOT_TOKEN = 'dev-test-token';
process.env.USER_JWT_SECRET = process.env.USER_JWT_SECRET || 'test-user-secret';
process.env.USER_JWT_EXPIRES_IN = '30d';

const { default: app } = await import('./src/app.js');
const { pool } = await import('./src/db/pool.js');
const { redis } = await import('./src/lib/redis.js');
const request = (await import('supertest')).default;

// Create viewer
const [vr] = await pool.query(
  `INSERT INTO users (telegram_id,telegram_username,phone_number,bank_id,region_id,zone_id,grade_id,
   full_name_en,branch_name_en,neighborhood_en,preferred_language,photo_source,is_active,profile_completed_at)
   VALUES (88880001,'diag_viewer','+25188880001',1,16,25,7,'Viewer','Branch','Hood','en','placeholder',TRUE,NOW())`
);
const viewerId = vr.insertId;

// Create candidate who wants viewer's zone
const [cr] = await pool.query(
  `INSERT INTO users (telegram_id,telegram_username,phone_number,bank_id,region_id,zone_id,grade_id,
   full_name_en,branch_name_en,neighborhood_en,preferred_language,photo_source,is_active,profile_completed_at)
   VALUES (88880002,'diag_candidate','+25188880002',1,16,25,8,'Candidate','Branch2','Hood2','en','placeholder',TRUE,NOW())`
);
const candidateId = cr.insertId;

// Candidate wants viewer's zone
await pool.query('INSERT INTO transfer_interests (user_id,region_id,zone_id) VALUES (?,16,25)', [candidateId]);
// Viewer wants their own zone (for mutual)
await pool.query('INSERT INTO transfer_interests (user_id,region_id,zone_id) VALUES (?,16,25)', [viewerId]);

// Get token
const tokenRes = await request(app).post('/api/v1/auth/issue-token').send({ telegram_id: 88880001 });
const token = tokenRes.body.data.token;
console.log('Token OK:', !!token);

// Hit feed
const feedRes = await request(app)
  .get('/api/v1/marketplace/feed?page=1&page_size=10&fresh=true')
  .set('Authorization', 'Bearer ' + token);

console.log('FEED STATUS:', feedRes.status);
console.log('FEED BODY:', JSON.stringify(feedRes.body, null, 2));

// Also try the SQL directly
try {
  const [rows] = await pool.query(
    `SELECT u.id, ug.band_number, ug.grade_number,
     CASE WHEN ti.zone_id IS NOT NULL THEN 'zone' ELSE 'region' END AS match_type
     FROM users u
     JOIN transfer_interests ti ON ti.user_id = u.id AND ((ti.zone_id = 25) OR (ti.zone_id IS NULL AND ti.region_id = 16))
     JOIN grades ug ON ug.id = u.grade_id
     JOIN regions r ON r.id = u.region_id
     JOIN zones z ON z.id = u.zone_id
     WHERE u.bank_id = 1 AND u.id != ? AND u.is_active = TRUE AND u.profile_completed_at IS NOT NULL AND ABS(ug.band_number - 3) <= 1
     LIMIT 10 OFFSET 0`,
    [viewerId]
  );
  console.log('DIRECT SQL OK, rows:', rows.length);
  console.log('ROWS:', JSON.stringify(rows, null, 2));
} catch (e) {
  console.log('DIRECT SQL ERROR:', e.message);
  console.log('SQL CODE:', e.code);
}

// Cleanup
await pool.query('DELETE FROM transfer_interests WHERE user_id IN (?,?)', [viewerId, candidateId]);
await pool.query('DELETE FROM users WHERE id IN (?,?)', [viewerId, candidateId]);
await pool.end();
redis.disconnect();
process.exit(0);
