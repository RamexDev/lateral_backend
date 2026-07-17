/**
 * Grade model — shared, industry-standard grade matrix (Ethiopian Banking Grade Matrix).
 * See backend.md §3.2 (grades) and §4.3 (seeding).
 *
 * Shared across all banks — same 1–18 rank scale makes grade-adjacency matching
 * (BR-003) consistent across banks rather than comparing incompatible per-bank scales.
 *
 * All four `_am` columns are NOT NULL (§16.1 — Amharic as first-class from day 1).
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

module.exports = sequelize.define(
  'Grade',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    grade_number: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      unique: true,
    },
    band_label: { type: DataTypes.STRING(40), allowNull: false },
    band_label_am: { type: DataTypes.STRING(60), allowNull: false },
    tier_classification: { type: DataTypes.STRING(60), allowNull: false },
    tier_classification_am: { type: DataTypes.STRING(80), allowNull: false },
    typical_roles: { type: DataTypes.STRING(255), allowNull: false },
    typical_roles_am: { type: DataTypes.STRING(255), allowNull: false },
    rank_order: { type: DataTypes.INTEGER, allowNull: false },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: 'grades',
    timestamps: true,
    underscored: true,
  },
);
