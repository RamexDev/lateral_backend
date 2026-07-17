module.exports = {
  development: {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3306),
      database: process.env.DB_NAME || 'lateral_transfer',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    },
    pool: {
      min: Number(process.env.DB_POOL_MIN || 2),
      max: Number(process.env.DB_POOL_MAX || 20),
    },
    migrations: {
      directory: './src/db/migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './src/db/seeds',
    },
  },
  production: {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    },
    pool: {
      min: Number(process.env.DB_POOL_MIN || 2),
      max: Number(process.env.DB_POOL_MAX || 20),
    },
    migrations: {
      directory: './src/db/migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './src/db/seeds',
    },
  },
  test: {
    client: 'better-sqlite3',
    connection: ':memory:',
    useNullAsDefault: true,
    pool: {
      min: 1,
      max: 1,
    },
    migrations: {
      directory: './src/db/migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './src/db/seeds',
    },
  },
};
