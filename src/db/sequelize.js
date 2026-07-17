/**
 * Sequelize instance factory.
 *
 * - Production/development: MySQL via mysql2 (config-driven).
 * - Tests: SQLite in-memory via sqlite3 (see src/db/config.js → test env).
 *
 * The same migration files run in both environments — they use Sequelize's
 * queryInterface API which is dialect-portable for the schema constructs we need
 * (CREATE TABLE with FKs, ENUMs, JSON columns, indexes).
 *
 * The closure-table rebuild (§4.2) is implemented in locationRepository.js as a
 * portable application-level walk that works on both MySQL and SQLite (no
 * `WITH RECURSIVE` dependency).
 */
const { Sequelize } = require('sequelize');
const config = require('./config');

const envName = process.env.NODE_ENV === 'test' ? 'test' : process.env.NODE_ENV === 'production' ? 'production' : 'development';
const envConfig = config[envName];

const sequelize = new Sequelize(
  envConfig.database || 'lateral_transfer',
  envConfig.username || (envName === 'test' ? undefined : 'root'),
  envConfig.password || (envName === 'test' ? undefined : ''),
  {
    dialect: envConfig.dialect,
    storage: envConfig.storage,
    host: envConfig.host,
    port: envConfig.port,
    logging: envConfig.logging,
    define: envConfig.define,
    pool: envConfig.pool,
    ssl: envConfig.ssl,
    // SQLite: don't bounce on a non-existent DB; in-memory is created on connect.
    ...(envConfig.dialect === 'sqlite' ? { retry: { max: 3 } } : {}),
  },
);

module.exports = sequelize;
