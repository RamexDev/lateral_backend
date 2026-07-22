// Import seed data.
import { banks } from './data/banks.js';
import { regions } from './data/regions.js';
import { zones } from './data/zones.js';
import { grades } from './data/grades.js';

// Import database pool.
import { pool } from '../db/pool.js';

// Import environment variables.
import { env } from '../config/env.js';

// Import logger.
import { logger } from '../lib/logger.js';

// Import password hashing.
import { hash } from '@node-rs/bcrypt';

// Resolve Amharic placeholder behavior.
function amharicPlaceholder(englishValue) {
  return englishValue;
}

// Seed banks using the corrected bilingual bank list.
async function seedBanks() {
  // Define the idempotent bank upsert query.
  const sql =
    'INSERT INTO banks (' +
    'id, name_en, name_am, alias_en, alias_am, swift_code, year_established, year_established_note, is_active' +
    ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE) ' +
    'ON DUPLICATE KEY UPDATE ' +
    'name_en = VALUES(name_en), ' +
    'name_am = VALUES(name_am), ' +
    'alias_en = VALUES(alias_en), ' +
    'alias_am = VALUES(alias_am), ' +
    'swift_code = VALUES(swift_code), ' +
    'year_established = VALUES(year_established), ' +
    'year_established_note = VALUES(year_established_note), ' +
    'is_active = VALUES(is_active)';

  // Insert or update each bank.
  for (const bank of banks) {
    await pool.query(sql, [
      bank.id,
      bank.name_en,
      bank.name_am,
      bank.alias_en,
      bank.alias_am,
      bank.swift_code ?? null,
      bank.year_established ?? null,
      bank.year_established_note ?? null
    ]);
  }

  // Log completion.
  logger.info('Seeded banks: ' + banks.length);
}

// Seed regions using simple English and Amharic names only.
async function seedRegions() {
  // Define the idempotent region upsert query.
  const sql =
    'INSERT INTO regions (' +
    'id, name_en, name_am, type, is_active' +
    ') VALUES (?, ?, ?, ?, TRUE) ' +
    'ON DUPLICATE KEY UPDATE ' +
    'name_en = VALUES(name_en), ' +
    'name_am = VALUES(name_am), ' +
    'type = VALUES(type), ' +
    'is_active = VALUES(is_active)';

  // Insert or update each region.
  for (const region of regions) {
    await pool.query(sql, [
      region.id,
      region.name_en,
      region.name_am,
      region.type
    ]);
  }

  // Log completion.
  logger.info('Seeded regions: ' + regions.length);
}


// Seed zones using exact database column names.
// Finfinne Special Zone (id 40) is inactive unless SEED_FINFINNE_SURROUNDING_ACTIVE=true.
async function seedZones() {
  // Determine whether Finfinne Special Zone should be active.
  const finfinneActive =
    process.env.SEED_FINFINNE_SURROUNDING_ACTIVE === 'true' ? 1 : 0;

  // Idempotent upsert query for zones.
  const sql =
    'INSERT INTO zones (' +
    'id, region_id, name_en, name_am, note, is_active' +
    ') VALUES (?, ?, ?, ?, ?, ?) ' +
    'ON DUPLICATE KEY UPDATE ' +
    'region_id = VALUES(region_id), ' +
    'name_en = VALUES(name_en), ' +
    'name_am = VALUES(name_am), ' +
    'note = VALUES(note), ' +
    'is_active = VALUES(is_active)';

  // Insert or update each zone.
  for (const zone of zones) {
    // Default active flag to 1 unless explicitly set.
    let isActive = zone.is_active ?? 1;

    // Override Finfinne Special Zone using the environment flag.
    if (zone.id === 40) {
      isActive = finfinneActive;
    }

    // Run the upsert query with exact column values.
    await pool.query(sql, [
      zone.id,
      zone.region_id,
      zone.name_en,
      zone.name_am,
      zone.note || null,
      isActive
    ]);
  }

  // Log completion count.
  logger.info('Seeded zones: ' + zones.length);
}

// Seed grades.
async function seedGrades() {
  const sql =
    'INSERT INTO grades (id, grade_number, band_number, band_label_en, band_label_am, tier_classification_en, tier_classification_am, rank_order, is_active) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE) ' +
    'ON DUPLICATE KEY UPDATE ' +
    'grade_number = VALUES(grade_number), ' +
    'band_number = VALUES(band_number), ' +
    'band_label_en = VALUES(band_label_en), ' +
    'band_label_am = VALUES(band_label_am), ' +
    'tier_classification_en = VALUES(tier_classification_en), ' +
    'tier_classification_am = VALUES(tier_classification_am), ' +
    'rank_order = VALUES(rank_order), ' +
    'is_active = VALUES(is_active)';

  for (const grade of grades) {
    await pool.query(sql, [
      grade.id,
      grade.grade_number,
      grade.band_number,
      grade.band_label_en,
      grade.band_label_am,
      grade.tier_classification_en,
      grade.tier_classification_am,
      grade.rank_order
    ]);
  }

  logger.info('Seeded grades: ' + grades.length);
}

// Seed super admin.
async function seedSuperAdmin() {
  const [rows] = await pool.query('SELECT id FROM staff WHERE email = ?', [env.SUPER_ADMIN_EMAIL]);

  if (rows.length > 0) {
    logger.info('Super admin already exists');
    return;
  }

  const passwordHash = await hash(env.SUPER_ADMIN_PASSWORD, 10);

  await pool.query(
    'INSERT INTO staff (full_name, email, password_hash, role, preferred_language, is_active) VALUES (?, ?, ?, ?, ?, TRUE)',
    [
      env.SUPER_ADMIN_FULL_NAME,
      env.SUPER_ADMIN_EMAIL,
      passwordHash,
      'super_admin',
      'en'
    ]
  );

  logger.info('Seeded super admin');
}

// Run all seed steps.
async function main() {
  await seedBanks();
  await seedRegions();
  await seedZones();
  await seedGrades();
  await seedSuperAdmin();

  await pool.end();
}

// Execute seeding.
main().catch((err) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});
