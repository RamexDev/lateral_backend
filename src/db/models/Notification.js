/**
 * Notification model — digest, broadcast, transactional notifications.
 * See backend.md §3.2 (notifications) and §9 (notification system).
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

module.exports = sequelize.define(
  'Notification',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    type: {
      type: DataTypes.ENUM('registration', 'digest', 'payment_confirmation', 'broadcast'),
      allowNull: false,
    },
    channel: {
      type: DataTypes.ENUM('telegram', 'email', 'sms'),
      allowNull: false,
      defaultValue: 'telegram',
    },
    payload: { type: DataTypes.JSON, allowNull: false },
    status: {
      type: DataTypes.ENUM('queued', 'sent', 'failed'),
      allowNull: false,
      defaultValue: 'queued',
    },
    sent_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: 'notifications',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [{ fields: ['user_id', 'created_at'], name: 'idx_notif_user' }],
  },
);
