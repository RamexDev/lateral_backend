/**
 * Role model — RBAC role.
 * See backend.md §3.2 (roles) and §11 (RBAC matrix).
 *
 * Seeded once at migration time with: super_admin | platform_admin | finance_officer |
 * support_officer.
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

module.exports = sequelize.define(
  'Role',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    name: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  },
  {
    tableName: 'roles',
    timestamps: false,
    underscored: true,
  },
);
