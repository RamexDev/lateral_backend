// Import MySQL pool.
import { pool } from '../db/pool.js';

// Import logger.
import { logger } from './logger.js';

// Write an audit log row without breaking the main request on failure.
export async function writeAudit({
  actorType,
  actorId = null,
  action,
  entityType = null,
  entityId = null,
  metadata = null
}) {
  try {
    // Insert audit row.
    await pool.query(
      'INSERT INTO audit_logs (' +
      'actor_type, actor_id, action, entity_type, entity_id, metadata' +
      ') VALUES (?, ?, ?, ?, ?, ?)',
      [
        actorType,
        actorId,
        action,
        entityType,
        entityId,
        metadata ? JSON.stringify(metadata) : null
      ]
    );
  } catch (err) {
    // Log audit failure but do not crash the main operation.
    logger.error({ err, action }, 'Failed to write audit log');
  }
}
