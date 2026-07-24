import { pool } from '../db/pool.js';
import { logger } from '../lib/logger.js';
import { testUsers } from './data/test-users.js';

async function seedTestUsers() {
  logger.info('Seeding ' + testUsers.length + ' test users for bank 1 (CBE)...');

  const insertedIds = [];

  for (const u of testUsers) {
    const telegramId = 4900000000 + u.id;

    const userSql =
      'INSERT INTO users (' +
      'telegram_id, telegram_username, phone_number, bank_id, region_id, zone_id, grade_id, ' +
      'full_name_en, full_name_am, branch_name_en, branch_name_am, neighborhood_en, neighborhood_am, ' +
      'preferred_language, photo_source, is_active, profile_completed_at' +
      ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW()) ' +
      'ON DUPLICATE KEY UPDATE ' +
      'telegram_username = VALUES(telegram_username), ' +
      'phone_number = VALUES(phone_number), ' +
      'bank_id = VALUES(bank_id), ' +
      'region_id = VALUES(region_id), ' +
      'zone_id = VALUES(zone_id), ' +
      'grade_id = VALUES(grade_id), ' +
      'full_name_en = VALUES(full_name_en), ' +
      'full_name_am = VALUES(full_name_am), ' +
      'branch_name_en = VALUES(branch_name_en), ' +
      'branch_name_am = VALUES(branch_name_am), ' +
      'neighborhood_en = VALUES(neighborhood_en), ' +
      'neighborhood_am = VALUES(neighborhood_am), ' +
      'preferred_language = VALUES(preferred_language), ' +
      'profile_completed_at = NOW()';

    const [result] = await pool.query(userSql, [
      telegramId,
      u.telegram_username,
      u.phone_number,
      u.bank_id,
      u.region_id,
      u.zone_id,
      u.grade_id,
      u.full_name_en,
      u.full_name_am,
      u.branch_name_en,
      u.branch_name_am,
      u.neighborhood_en,
      u.neighborhood_am,
      'en',
      'placeholder'
    ]);

    const userId = result.insertId;
    insertedIds.push({ id: userId, telegram_id: telegramId, username: u.telegram_username });

    await pool.query('DELETE FROM transfer_interests WHERE user_id = ?', [userId]);

    for (const interest of u.interests) {
      await pool.query(
        'INSERT INTO transfer_interests (user_id, region_id, zone_id) VALUES (?, ?, ?)',
        [userId, interest.region_id, interest.zone_id ?? null]
      );
    }
  }

  logger.info('Seeded ' + insertedIds.length + ' test users with transfer interests.');

  console.log('\nTest users created — use these telegram_ids to issue auth tokens:\n');
  for (const u of insertedIds) {
    console.log(
      '  ' + u.username.padEnd(16) + '  telegram_id: ' + u.telegram_id + '  user_id: ' + u.id
    );
  }
  console.log(
    '\nIssue a token: POST /api/v1/auth/issue-token  { "telegram_id": <telegram_id> }'
  );
  console.log('Bank: Commercial Bank of Ethiopia (CBE) — bank_id: 1\n');
}

async function main() {
  try {
    await seedTestUsers();
  } catch (err) {
    logger.error({ err }, 'Test user seed failed');
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
