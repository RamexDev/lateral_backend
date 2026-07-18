/**
 * StaffRefreshToken model — backing storage for the 7-day staff refresh token
 * (SEC-009, answers.md §D).
 *
 * See migration 20240101000010-create-staff-refresh-tokens for the schema.
 * The raw token is never stored — only its SHA-256 hash.
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

module.exports = sequelize.define(
  'StaffRefreshToken',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    staff_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    revoked_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: 'staff_refresh_tokens',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
  },
);
