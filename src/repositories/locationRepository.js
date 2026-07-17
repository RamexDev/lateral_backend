/**
 * Location repository — CRUD over `locations` + `location_ancestors` closure table.
 * See backend.md §3.2, §4.2 (closure maintenance), §6.9 (admin location endpoints).
 *
 * Uses Sequelize models with raw queries where the closure table or language-aware
 * name resolution makes the model API awkward.
 */
const { Location, LocationAncestor, User } = require('../db/models');
const sequelize = require('../db/sequelize');
const { QueryTypes } = require('sequelize');

const LOC_TABLE = 'locations';
const ANC_TABLE = 'location_ancestors';

function locationAttributes(lang) {
  return lang === 'am'
    ? ['id', 'parent_id', 'level_type', 'is_active', ['name_am', 'name']]
    : ['id', 'parent_id', 'level_type', 'is_active', 'name'];
}

function locationAttributesNoParent(lang) {
  return lang === 'am' ? ['id', ['name_am', 'name']] : ['id', 'name'];
}

module.exports = {
  LOC_TABLE,
  ANC_TABLE,

  async findById(id, lang = 'en') {
    return Location.findOne({
      attributes: locationAttributes(lang),
      where: { id },
      raw: true,
    });
  },

  async findByIdRaw(id) {
    return Location.findByPk(id, { raw: true });
  },

  async listRegions(lang = 'en') {
    return Location.findAll({
      attributes: locationAttributesNoParent(lang).concat(['is_active']),
      where: { level_type: 'region' },
      order: [['name', 'ASC']],
      raw: true,
    });
  },

  async listActiveRegions(lang = 'en') {
    return Location.findAll({
      attributes: locationAttributesNoParent(lang),
      where: { level_type: 'region', is_active: true },
      order: [['name', 'ASC']],
      raw: true,
    });
  },

  async listZonesByRegion(regionId, lang = 'en') {
    return Location.findAll({
      attributes: locationAttributesNoParent(lang),
      where: { parent_id: regionId, level_type: 'zone_subcity' },
      order: [['name', 'ASC']],
      raw: true,
    });
  },

  async listActiveZonesByRegion(regionId, lang = 'en') {
    return Location.findAll({
      attributes: locationAttributesNoParent(lang),
      where: {
        parent_id: regionId,
        level_type: 'zone_subcity',
        is_active: true,
      },
      order: [['name', 'ASC']],
      raw: true,
    });
  },

  async create(data) {
    const row = await Location.create(data);
    return row.id;
  },

  async update(id, patch) {
    const [affected] = await Location.update(patch, { where: { id } });
    return affected > 0;
  },

  async countActiveUsers(locationId) {
    return User.count({
      where: { current_location_id: locationId, is_active: true },
    });
  },

  /**
   * Is `ancestorId` an ancestor (or self) of `descendantId`?
   * Uses the closure table directly.
   */
  async isAncestorOf(ancestorId, descendantId) {
    const row = await LocationAncestor.findOne({
      attributes: ['depth'],
      where: { ancestor_id: ancestorId, descendant_id: descendantId },
      raw: true,
    });
    return row ? row.depth : null;
  },

  /**
   * Full rebuild of the closure table (§4.2). Portable application-level walk
   * that works on both MySQL 8+ and SQLite (no `WITH RECURSIVE` dependency).
   */
  async rebuildClosure() {
    const t = await sequelize.transaction();
    try {
      await LocationAncestor.destroy({ where: {}, truncate: true, transaction: t });
      const all = await Location.findAll({
        attributes: ['id', 'parent_id'],
        raw: true,
        transaction: t,
      });
      const byId = new Map(all.map((r) => [r.id, r]));

      const rows = [];
      for (const node of all) {
        rows.push({ ancestor_id: node.id, descendant_id: node.id, depth: 0 });

        let depth = 1;
        let current = node;
        const seen = new Set([node.id]);
        // Cap at 50 to prevent infinite loops in pathological data.
        while (current.parent_id && byId.has(current.parent_id) && depth < 50) {
          const parent = byId.get(current.parent_id);
          if (seen.has(parent.id)) break; // cycle guard
          seen.add(parent.id);
          rows.push({ ancestor_id: parent.id, descendant_id: node.id, depth });
          current = parent;
          depth += 1;
        }
      }

      if (rows.length) {
        const CHUNK = 500;
        for (let i = 0; i < rows.length; i += CHUNK) {
          await LocationAncestor.bulkCreate(rows.slice(i, i + CHUNK), {
            transaction: t,
            validate: false,
          });
        }
      }
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },
};
