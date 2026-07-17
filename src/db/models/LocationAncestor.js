/**
 * LocationAncestor model — precomputed transitive closure over `locations`.
 * See backend.md §3.2 (location_ancestors) and §4.2 (closure maintenance).
 *
 * depth = 0 rows are self-references; depth > 0 rows are true ancestors.
 *
 * Managed by locationRepository.rebuildClosure() (full rebuild on every admin
 * mutation — table is small at 119 nodes). Not created/updated via this model's
 * CRUD methods under normal flow; the model exists for query convenience.
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

module.exports = sequelize.define(
  'LocationAncestor',
  {
    ancestor_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      allowNull: false,
    },
    descendant_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      allowNull: false,
    },
    depth: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    tableName: 'location_ancestors',
    timestamps: false,
    underscored: true,
    indexes: [{ fields: ['descendant_id'], name: 'idx_la_descendant' }],
  },
);
