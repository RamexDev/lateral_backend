/**
 * User model — registered bank employees seeking lateral transfers.
 * See backend.md §3.2 (users table).
 *
 * Notes:
 * - current_location_id references locations.level_type='zone_subcity'
 * - branch_name + neighborhood are free text, only revealed on paid purchase (SEC-010)
 * - uq_phone_bank enforces FR-AUTH-003 (no duplicate phone under same bank across Telegram accounts)
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

module.exports = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    telegram_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      unique: true,
    },
    telegram_username: { type: DataTypes.STRING(64), allowNull: true },
    phone_number: { type: DataTypes.STRING(20), allowNull: false },
    phone_verified_at: { type: DataTypes.DATE, allowNull: true },
    bank_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    current_location_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    branch_name: { type: DataTypes.STRING(150), allowNull: false },
    neighborhood: { type: DataTypes.STRING(150), allowNull: true },
    grade_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    preferred_language: {
      type: DataTypes.ENUM('en', 'am'),
      allowNull: false,
      defaultValue: 'en',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    last_digest_at: { type: DataTypes.DATE, allowNull: true },
    last_activity_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: 'users',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['phone_number', 'bank_id'],
        name: 'uq_phone_bank',
      },
      { fields: ['bank_id', 'current_location_id'], name: 'idx_user_bank_location' },
      { fields: ['is_active', 'last_activity_at'], name: 'idx_user_activity' },
    ],
  },
);
