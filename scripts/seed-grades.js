/**
 * Standalone grade matrix seed script — §4.3.
 * Usage: `npm run seed:grades`
 */
const { seedGrades } = require('../src/db/seed_lib/grades');

seedGrades()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', err);
    process.exit(1);
  });
