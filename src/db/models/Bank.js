/**
 * Bank model — reference data: bank directory shared across the platform.
 * See backend.md §3.2 (banks table).
 *
 * `name_am` (Amharic) is NOT NULL — enforced from day 1 per §16.1.
 *
 * Note: attribute names are intentionally snake_case to match the DB column names.
 * This keeps repository return values consistent with the existing service code
 * (which expects `row.name_am`, `row.bank_id`, etc.).
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

module.exports = sequelize.define(
  'Bank',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    name: { type: DataTypes.STRING(150), allowNull: false },
    name_am: { type: DataTypes.STRING(150), allowNull: false },
    nickname: { type: DataTypes.STRING(30), allowNull: false, unique: true },
    swift_code: { type: DataTypes.STRING(11), allowNull: true },
    year_established: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: true },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: 'banks',
    timestamps: true,
    underscored: true,
  },
);
