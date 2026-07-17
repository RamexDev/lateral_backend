/**
 * AuditLog model — write-through audit trail for sensitive actions.
 * See backend.md §3.2 (audit_logs) and SEC-006.
 *
 * Polymorphic actor (actor_type + actor_id) and entity (entity_type + entity_id)
 * references — no FK constraints because actors can be users, staff, or 'system'.
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

module.exports = sequelize.define(
  'AuditLog',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    actor_type: {
      type: DataTypes.ENUM('user', 'staff', 'system'),
      allowNull: false,
    },
    actor_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    action: { type: DataTypes.STRING(100), allowNull: false },
    entity_type: { type: DataTypes.STRING(50), allowNull: false },
    entity_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    metadata: { type: DataTypes.JSON, allowNull: true },
    ip_address: { type: DataTypes.STRING(45), allowNull: true },
  },
  {
    tableName: 'audit_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['entity_type', 'entity_id'], name: 'idx_audit_entity' },
      { fields: ['actor_type', 'actor_id'], name: 'idx_audit_actor' },
    ],
  },
);
