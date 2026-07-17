/**
 * Sequelize connection config — consumed by sequelize-cli and by src/db/sequelize.js.
 *
 * Per-NODE_ENV params read from process.env. Tests use an in-memory SQLite (dialect 'sqlite',
 * storage ':memory:'); dev/prod use MySQL via mysql2.
 *
 * Mirrors the env vars from backend.md §13.
 */
const isTest = process.env.NODE_ENV === 'test';
const isProd = process.env.NODE_ENV === 'production';

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

const common = {
  define: {
    // snake_case columns in the DB, snake_case JS attribute names on the models
    // (see model files — we deliberately use DB column names as JS attribute names
    // so repository return values are consistent across `raw: true` and instances).
    underscored: true,
    timestamps: true,
  },
  logging: isProd ? false : (msg) => {
    if (!isTest && process.env.SEQUELIZE_LOG === 'true') console.log(msg);
  },
  pool: {
    min: Number(process.env.DB_POOL_MIN || 2),
    max: Number(process.env.DB_POOL_MAX || 20),
    acquire: 30000,
    idle: 10000,
  },
};

const test = {
  dialect: 'sqlite',
  storage: ':memory:',
  ...common,
  logging: false, // keep jest output clean
  define: { ...common.define, timestamps: true },
};

const development = {
  dialect: 'mysql',
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || 'lateral_transfer',
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  ...common,
};

// Production is built lazily — only resolves required env vars when actually loaded,
// so test environments don't crash on missing DB_HOST.
const production = isProd
  ? {
      dialect: 'mysql',
      host: required('DB_HOST'),
      port: Number(process.env.DB_PORT || 3306),
      database: required('DB_NAME'),
      username: required('DB_USER'),
      password: required('DB_PASSWORD'),
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
      ...common,
      logging: false,
    }
  : {
      // Placeholder so module.exports doesn't crash; never used outside production.
      dialect: 'mysql',
      host: 'localhost',
      port: 3306,
      database: 'lateral_transfer',
      username: 'root',
      password: '',
      ...common,
      logging: false,
    };

module.exports = { test, development, production };
