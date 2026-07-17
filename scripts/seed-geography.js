/**
 * Standalone geography seed script — §4.1.
 *
 * Runs the Sequelize banks + geography seeders directly (without going through
 * sequelize-cli), so `npm run seed:geography` works in environments where the CLI
 * isn't available.
 *
 * Usage: `npm run seed:geography`
 */
const path = require('path');
const sequelize = require('../src/db/sequelize');
const logger = require('../src/utils/logger');

const banksSeeder = require('../src/db/seeders/20240101000001-banks');
const geographySeeder = require('../src/db/seeders/20240101000002-geography');
const { QueryTypes } = require('sequelize');

async function main() {
  await sequelize.authenticate();
  logger.info('Connected to DB — running geography seed');

  // Use queryInterface from the live sequelize instance.
  const queryInterface = sequelize.getQueryInterface();
  const Sequelize = sequelize.constructor;

  await banksSeeder.up(queryInterface, Sequelize);
  logger.info('Banks seeded');

  await geographySeeder.up(queryInterface, Sequelize);
  logger.info('Geography seeded + closure table rebuilt');

  await sequelize.close();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', err);
    process.exit(1);
  });
