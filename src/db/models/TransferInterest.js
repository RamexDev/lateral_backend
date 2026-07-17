/**
 * TransferInterest model — a user's set of desired transfer locations.
 * See backend.md §3.2 (transfer_interests) and §6.4 (interest API).
 *
 * uq_user_location guarantees idempotent re-confirm: re-selecting an already-saved
 * zone is a no-op.
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

module.exports = sequelize.define(
  'TransferInterest',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    location_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  },
  {
    tableName: 'transfer_interests',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false, // spec schema has only created_at on this table
    underscored: true,
    indexes: [
      { unique: true, fields: ['user_id', 'location_id'], name: 'uq_user_location' },
      { fields: ['location_id'], name: 'idx_ti_location' },
      { fields: ['user_id'], name: 'idx_ti_user' },
      { fields: ['created_at'], name: 'idx_ti_created' },
    ],
  },
);
