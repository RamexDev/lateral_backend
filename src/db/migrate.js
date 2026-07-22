// Import file system helpers.
import fs from 'node:fs/promises';

// Import path helpers.
import path from 'node:path';

// Import URL helper for ESM directory resolution.
import { fileURLToPath } from 'node:url';

// Import mysql2 promise API.
import mysql from 'mysql2/promise';

// Import environment variables.
import { env } from '../config/env.js';

// Import logger.
import { logger } from '../lib/logger.js';

// Resolve current directory.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Run all pending SQL migrations.
async function main() {
  // Create a dedicated connection with multipleStatements enabled.
  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    multipleStatements: true
  });

  try {
    // Ensure migration tracking table exists.
    await connection.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(191) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)'
    );

    // Resolve migrations directory.
    const migrationsDir = path.join(__dirname, 'migrations');

    // Read SQL files in alphabetical order.
    const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();

    // Apply each migration once.
    for (const file of files) {
      const [rows] = await connection.query('SELECT name FROM schema_migrations WHERE name = ?', [file]);

      if (rows.length > 0) {
        continue;
      }

      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      await connection.query(sql);
      await connection.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      logger.info('Applied migration ' + file);
    }
  } finally {
    await connection.end();
  }
}

// Execute migration runner.
main().catch((err) => {
  logger.error({ err }, 'Migration failed');
  process.exit(1);
});
