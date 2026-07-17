/**
 * Jest setup — runs once before any test file.
 *
 * Boots a fresh in-memory SQLite DB, runs all migrations, seeds reference data
 * (banks + locations + grades), and clears the cache between tests.
 *
 * Each test runs in isolation: domain tables (users, interests, purchases, etc.)
 * are truncated before every test, while reference data (banks, locations, grades,
 * roles) is preserved.
 */
const db = require('../src/db/knex');
const { resetForTests } = require('../src/utils/cache');

beforeAll(async () => {
  // Run migrations on the in-memory SQLite DB.
  await db.migrate.latest();
  // Seed reference data (banks, locations, grades, super admin).
  await db.seed.run();
  // Force the cache into in-memory mode for tests.
  resetForTests();
});

beforeEach(async () => {
  // Truncate domain tables before each test so tests are isolated.
  // Order matters: respect FK constraints.
  await db('audit_logs').del();
  await db('notifications').del();
  await db('payments').del();
  await db('purchases').del();
  await db('transfer_interests').del();
  await db('users').del();
  await db('staff').del();
  // Clear the in-memory cache (bot sessions, feed cache, rate-limit counters).
  const { getBackend } = require('../src/utils/cache');
  const cache = await getBackend();
  if (cache && cache._store) cache._store.clear();
});

afterAll(async () => {
  await db.destroy();
});
