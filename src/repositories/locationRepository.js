/**
 * Location repository — CRUD over `locations` + `location_ancestors` closure table.
 * See backend.md §3.2, §4.2 (closure maintenance), §6.9 (admin location endpoints).
 */
const db = require('../db/knex');
const LOC_TABLE = 'locations';
const ANC_TABLE = 'location_ancestors';

const nameColumn = (lang) => (lang === 'am' ? 'name_am as name' : 'name');

module.exports = {
  LOC_TABLE,
  ANC_TABLE,

  async findById(id, lang = 'en') {
    return db(LOC_TABLE)
      .select('id', 'parent_id', 'level_type', 'is_active', db.raw(nameColumn(lang)))
      .where({ id })
      .first();
  },

  async findByIdRaw(id) {
    return db(LOC_TABLE).select('*').where({ id }).first();
  },

  async listRegions(lang = 'en') {
    return db(LOC_TABLE)
      .select('id', db.raw(nameColumn(lang)), 'is_active')
      .where({ level_type: 'region' })
      .orderBy('name', 'asc');
  },

  async listActiveRegions(lang = 'en') {
    return db(LOC_TABLE)
      .select('id', db.raw(nameColumn(lang)))
      .where({ level_type: 'region', is_active: true })
      .orderBy('name', 'asc');
  },

  async listZonesByRegion(regionId, lang = 'en') {
    return db(LOC_TABLE)
      .select('id', db.raw(nameColumn(lang)))
      .where({ parent_id: regionId, level_type: 'zone_subcity' })
      .orderBy('name', 'asc');
  },

  async listActiveZonesByRegion(regionId, lang = 'en') {
    return db(LOC_TABLE)
      .select('id', db.raw(nameColumn(lang)))
      .where({ parent_id: regionId, level_type: 'zone_subcity', is_active: true })
      .orderBy('name', 'asc');
  },

  async create(data) {
    const [id] = await db(LOC_TABLE).insert(data);
    return id;
  },

  async update(id, patch) {
    const affected = await db(LOC_TABLE).where({ id }).update(patch);
    return affected > 0;
  },

  async countActiveUsers(locationId) {
    const res = await db('users')
      .where({ current_location_id: locationId, is_active: true })
      .count('* as count')
      .first();
    return Number(res?.count || 0);
  },

  /**
   * Is `ancestorId` an ancestor (or self) of `descendantId`?
   * Uses the closure table directly.
   */
  async isAncestorOf(ancestorId, descendantId) {
    const row = await db(ANC_TABLE)
      .select('depth')
      .where({ ancestor_id: ancestorId, descendant_id: descendantId })
      .first();
    return row ? row.depth : null;
  },

  /**
   * Full rebuild of the closure table (§4.2). Application-level walk so it works
   * on both MySQL 8+ and SQLite (no `WITH RECURSIVE` dependency).
   */
  async rebuildClosure() {
    await db.transaction(async (trx) => {
      await trx(ANC_TABLE).del();
      const all = await trx(LOC_TABLE).select('id', 'parent_id');
      const byId = new Map(all.map((r) => [r.id, r]));

      const rows = [];
      for (const node of all) {
        // Self reference, depth 0.
        rows.push({ ancestor_id: node.id, descendant_id: node.id, depth: 0 });

        // Walk up via parent_id chain.
        let depth = 1;
        let current = node;
        // Cap at 50 to prevent infinite loops in pathological data.
        while (current.parent_id && byId.has(current.parent_id) && depth < 50) {
          const parent = byId.get(current.parent_id);
          // Cycle guard — if we've seen this parent before in this walk, stop.
          if (parent.id === node.id) break;
          rows.push({ ancestor_id: parent.id, descendant_id: node.id, depth });
          current = parent;
          depth += 1;
          if (current.id === current.parent_id) break; // self-loop in data, abort
        }
      }

      if (rows.length) {
        // SQLite has a 999-default variable limit; chunk to be safe.
        const CHUNK = 500;
        for (let i = 0; i < rows.length; i += CHUNK) {
          await trx(ANC_TABLE).insert(rows.slice(i, i + CHUNK));
        }
      }
    });
  },
};
