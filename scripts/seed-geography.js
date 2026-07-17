/**
 * Standalone geography seed script — §4.1.
 * Usage: `npm run seed:geography`
 */
const { seedBanks, seedGeography } = require('../src/db/seed_lib/geography');

Promise.resolve()
  .then(() => seedBanks())
  .then(() => seedGeography())
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', err);
    process.exit(1);
  });
