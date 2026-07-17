/**
 * Staff model — admin PWA users with RBAC roles.
 * See backend.md §3.2 (staff) and §11 (RBAC matrix).
 *
 * `preferred_language` is the Admin PWA locale per §16.3.
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

module.exports = sequelize.define(
  'Staff',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    full_name: { type: DataTypes.STRING(150), allowNull: false },
    email: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING(255), allowNull: false },
    role_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
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
    last_login_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: 'staff',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
  },
);
