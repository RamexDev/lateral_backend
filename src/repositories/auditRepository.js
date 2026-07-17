/**
 * Audit log repository — write-through audit trail for sensitive actions.
 * See backend.md §3.2 (audit_logs) and SEC-006.
 */
const { AuditLog } = require('../db/models');
const TABLE = 'audit_logs';

module.exports = {
  TABLE,

  async log(entry) {
    const row = await AuditLog.create({
      actor_type: entry.actorType,
      actor_id: entry.actorId ?? null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      metadata: entry.metadata ?? null,
      ip_address: entry.ipAddress ?? null,
    });
    return row.id;
  },

  async listByEntity(entityType, entityId, { limit = 50 } = {}) {
    return AuditLog.findAll({
      where: { entity_type: entityType, entity_id: entityId },
      order: [['created_at', 'DESC']],
      limit,
      raw: true,
    });
  },

  async listByActor(actorType, actorId, { limit = 50 } = {}) {
    return AuditLog.findAll({
      where: { actor_type: actorType, actor_id: actorId },
      order: [['created_at', 'DESC']],
      limit,
      raw: true,
    });
  },
};
