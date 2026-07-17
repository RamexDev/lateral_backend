/**
 * Payment model — Telegram Bot Payments integration record.
 * See backend.md §3.2 (payments) and §6.7 (payments webhooks).
 *
 * telegram_charge_id UNIQUE: idempotency key for FR-PAY-002.
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

module.exports = sequelize.define(
  'Payment',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    purchase_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    telegram_charge_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
    },
    provider: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'telegram_stars',
    },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    currency: { type: DataTypes.STRING(10), allowNull: false },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
      allowNull: false,
      defaultValue: 'pending',
    },
    raw_payload: { type: DataTypes.JSON, allowNull: true },
  },
  {
    tableName: 'payments',
    timestamps: true,
    underscored: true,
  },
);
