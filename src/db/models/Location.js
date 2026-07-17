/**
 * Location model — shared administrative geography (region + zone_subcity).
 * See backend.md §3.2 (locations) and §3.1 (design note).
 *
 * Self-reference via parent_id (region → zone_subcity). The flattened closure lives
 * in location_ancestors (see LocationAncestor model + locationRepository.rebuildClosure).
 *
 * Bank-agnostic: every bank shares the same geography. A user's exact branch identity
 * is captured as free text on the users row (branch_name + neighborhood).
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

module.exports = sequelize.define(
  'Location',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    parent_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: { model: 'locations', key: 'id' },
      onDelete: 'RESTRICT',
    },
    name: { type: DataTypes.STRING(150), allowNull: false },
    name_am: { type: DataTypes.STRING(150), allowNull: false },
    level_type: {
      type: DataTypes.ENUM('region', 'zone_subcity'),
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: 'locations',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['parent_id'], name: 'idx_loc_parent' },
      { fields: ['level_type'], name: 'idx_loc_level' },
    ],
  },
);
