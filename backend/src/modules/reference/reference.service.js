// Reference data service — public read access to regions and zones.
// Used by the mini app to populate region/zone pickers without hardcoding seed data.

import { pool } from '../../db/pool.js';
import { ApiError } from '../../lib/errors.js';

// List all active regions, ordered by ID for stable display.
export async function listRegions() {
  const [rows] = await pool.query(
    'SELECT id, name_en, name_am, type FROM regions WHERE is_active = TRUE ORDER BY id ASC'
  );

  return {
    regions: rows.map((row) => ({
      id: row.id,
      name_en: row.name_en,
      name_am: row.name_am,
      type: row.type
    }))
  };
}

// List active zones for a region.
// If regionId is omitted, returns all active zones (with their region_id).
export async function listZones(regionId) {
  let sql =
    'SELECT z.id, z.region_id, z.name_en, z.name_am, r.name_en AS region_name_en, r.name_am AS region_name_am ' +
    'FROM zones z ' +
    'JOIN regions r ON r.id = z.region_id ' +
    'WHERE z.is_active = TRUE AND r.is_active = TRUE';

  const params = [];

  if (regionId) {
    // Validate region exists and is active.
    const [regionRows] = await pool.query(
      'SELECT id FROM regions WHERE id = ? AND is_active = TRUE',
      [regionId]
    );
    if (regionRows.length === 0) {
      throw new ApiError(404, 'NOT_FOUND', 'Region not found or inactive.');
    }

    sql += ' AND z.region_id = ?';
    params.push(regionId);
  }

  sql += ' ORDER BY z.region_id ASC, z.id ASC';

  const [rows] = await pool.query(sql, params);

  return {
    zones: rows.map((row) => ({
      id: row.id,
      region_id: row.region_id,
      name_en: row.name_en,
      name_am: row.name_am,
      region_name_en: row.region_name_en,
      region_name_am: row.region_name_am
    }))
  };
}
