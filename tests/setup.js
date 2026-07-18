/**
 * Jest setup — runs once before any test file.
 *
 * Boots a fresh in-memory SQLite DB, runs all Sequelize migrations, seeds reference data
 * (banks + locations + grades + super admin), and clears the cache between tests.
 *
 * Each test runs in isolation: domain tables (users, interests, purchases, etc.)
 * are truncated before every test, while reference data (banks, locations, grades,
 * roles) is preserved.
 */
const sequelize = require('../src/db/sequelize');
const { sequelize: sequelizeInstance } = require('../src/db/models');
const { resetForTests } = require('../src/utils/cache');

beforeAll(async () => {
  // Run migrations on the in-memory SQLite DB.
  await sequelize.authenticate();
  // Run the migration files in order (they're not auto-run on sync — invoke explicitly).
  const migrations = [
    require('../src/db/migrations/20240101000001-create-banks'),
    require('../src/db/migrations/20240101000002-create-locations'),
    require('../src/db/migrations/20240101000003-create-location-ancestors'),
    require('../src/db/migrations/20240101000004-create-grades'),
    require('../src/db/migrations/20240101000005-create-roles-and-staff'),
    require('../src/db/migrations/20240101000006-create-users'),
    require('../src/db/migrations/20240101000007-create-transfer-interests'),
    require('../src/db/migrations/20240101000008-create-purchases-and-payments'),
    require('../src/db/migrations/20240101000009-create-notifications-and-audit-logs'),
    require('../src/db/migrations/20240101000010-create-staff-refresh-tokens'),
  ];
  const Sequelize = sequelize.constructor;
  const queryInterface = sequelize.getQueryInterface();
  for (const m of migrations) {
    await m.up(queryInterface, Sequelize);
  }

  // Seed reference data (banks, locations, grades, super admin).
  const seeders = [
    require('../src/db/seeders/20240101000001-banks'),
    require('../src/db/seeders/20240101000002-geography'),
    require('../src/db/seeders/20240101000003-grades'),
    require('../src/db/seeders/20240101000004-super-admin'),
  ];
  for (const s of seeders) {
    await s.up(queryInterface, Sequelize);
  }

  // Force the cache into in-memory mode for tests.
  resetForTests();
});

beforeEach(async () => {
  // Reset rate-limiter counters so DB ID reuse (after sqlite_sequence reset)
  // doesn't cause false-positive 403s.
  try {
    require('../src/middlewares/rateLimit')._resetForTests();
  } catch {
    /* rate limit module not yet loaded — skip */
  }

  // Truncate domain tables before each test so tests are isolated.
  // Order matters: respect FK constraints.
  // Use raw TRUNCATE via queryInterface for speed.
  const tables = [
    'audit_logs',
    'notifications',
    'staff_refresh_tokens',
    'payments',
    'purchases',
    'transfer_interests',
    'users',
    'staff',
  ];
  for (const table of tables) {
    await sequelize.query(`DELETE FROM ${table}`);
  }
  // Reset auto-increment counters so test IDs are deterministic across runs.
  for (const table of tables) {
    // SQLite: DELETE FROM sqlite_sequence WHERE name = ?
    await sequelize.query(`DELETE FROM sqlite_sequence WHERE name = '${table}'`).catch(() => {
      /* not all dialects have sqlite_sequence */
    });
  }

  // Clear the in-memory cache (bot sessions, feed cache, rate-limit counters).
  const { getBackend } = require('../src/utils/cache');
  const cache = await getBackend();
  if (cache && cache._store) cache._store.clear();
});

afterAll(async () => {
  await sequelize.close().catch(() => {
    /* ignore — already closed */
  });
});
