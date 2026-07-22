// Import mysql2 promise API.
import mysql from 'mysql2/promise';

// Import environment variables.
import { env } from '../config/env.js';

// Create and export a MySQL connection pool.
export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  connectionLimit: env.DB_CONNECTION_LIMIT,
  waitForConnections: true,
  timezone: 'Z'
});

// Export a simple query helper.
export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

// Export a transaction helper.
export async function transaction(handler) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}
