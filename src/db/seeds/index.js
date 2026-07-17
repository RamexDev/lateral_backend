/**
 * Knex seed runner — invoked via `npm run seed`.
 *
 * Order matters: banks + locations first (no FK deps), then closure table rebuild,
 * then grades, then super admin.
 */
const { seedBanks, seedGeography } = require('../seed_lib/geography');
const { seedGrades } = require('../seed_lib/grades');
const { seedSuperAdmin } = require('../seed_lib/super_admin');

exports.seed = async function () {
  await seedBanks();
  await seedGeography(); // includes closure rebuild
  await seedGrades();
  await seedSuperAdmin();
};
