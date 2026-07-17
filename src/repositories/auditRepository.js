/**
 * Audit log repository — write-through audit trail for sensitive actions.
 * See backend.md §3.2 (audit_logs) and SEC-006.
 */
const db = require('../db/knex');
const TABLE = 'audit_logs';

module.exports = {
  TABLE,

  async log(entry) {
    const [id] = await db(TABLE).insert({
      actor_type: entry.actorType,
      actor_id: entry.actorId ?? null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      ip_address: entry.ipAddress ?? null,
    });
    return id;
  },

  async listByEntity(entityType, entityId, { limit = 50 } = {}) {
    return db(TABLE)
      .select('*')
      .where({ entity_type: entityType, entity_id: entityId })
      .orderBy('created_at', 'desc')
      .limit(limit);
  },

  async listByActor(actorType, actorId, { limit = 50 } = {}) {
    return db(TABLE)
      .select('*')
      .where({ actor_type: actorType, actor_id: actorId })
      .orderBy('created_at', 'desc')
      .limit(limit);
  },
};
