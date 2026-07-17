/**
 * Purchase model — reveal purchase record.
 * See backend.md §3.2 (purchases) and §6.7 (purchase API).
 *
 * - revealed_fields JSON: which contact fields were unlocked
 * - uq_buyer_target enforces BR-006: never charge the same buyer twice for the same target
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

module.exports = sequelize.define(
  'Purchase',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    buyer_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    target_user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    matched_interest_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    revealed_fields: { type: DataTypes.JSON, allowNull: false },
    payment_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  },
  {
    tableName: 'purchases',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [
      // BR-006: never charge twice
      { unique: true, fields: ['buyer_id', 'target_user_id'], name: 'uq_buyer_target' },
    ],
  },
);
