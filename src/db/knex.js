/**
 * Knex instance factory.
 *
 * Production: MySQL via mysql2 (config-driven).
 * Tests: SQLite in-memory via better-sqlite3 (see knexfile.js test env).
 *
 * The same migration files run in both environments — they use portable types
 * (integer, string, timestamp) and avoid MySQL-only constructs in schema creation.
 *
 * The closure-table rebuild (§4.2) is implemented in locationService.js as a
 * portable application-level walk that works on both MySQL and SQLite.
 */
const knex = require('knex');
const config = require('../config');
const knexfile = require('../../knexfile');

const envName = config.isTest ? 'test' : config.isProd ? 'production' : 'development';

const instance = knex(knexfile[envName]);

module.exports = instance;
