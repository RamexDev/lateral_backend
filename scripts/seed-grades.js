/**
 * Standalone grade matrix seed script — §4.3.
 *
 * Runs the Sequelize grades seeder directly (without sequelize-cli), so
 * `npm run seed:grades` works in environments where the CLI isn't available.
 *
 * Usage: `npm run seed:grades`
 */
const sequelize = require('../src/db/sequelize');
const logger = require('../src/utils/logger');
const gradesSeeder = require('../src/db/seeders/20240101000003-grades');

async function main() {
  await sequelize.authenticate();
  logger.info('Connected to DB — running grades seed');

  const queryInterface = sequelize.getQueryInterface();
  const Sequelize = sequelize.constructor;

  await gradesSeeder.up(queryInterface, Sequelize);
  logger.info('Grades seeded');

  await sequelize.close();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', err);
    process.exit(1);
  });
