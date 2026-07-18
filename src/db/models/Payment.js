/**
 * Payment model — provider-agnostic payment record (§3.2, §6.7, answers.md §1).
 *
 * provider_charge_id UNIQUE: idempotency key for FR-PAY-002. Stores Chapa's
 * `tx_ref` (format: "purchase:<purchaseId>") or any future provider's canonical
 * charge id.
 *
 * The `provider` column defaults to 'chapa' (the off-platform checkout provider
 * chosen in answers.md §1). The column was originally named `telegram_charge_id`
 * when Telegram Stars was the default; renamed when the default provider switched.
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
    provider_charge_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
    },
    provider: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'chapa',
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
