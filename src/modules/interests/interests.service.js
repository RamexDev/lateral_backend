// Import MySQL pool.
import { pool } from '../../db/pool.js';

// Import API error class.
import { ApiError } from '../../lib/errors.js';

// Import audit helper.
import { writeAudit } from '../../lib/audit.js';

// Import interest limits.
import { INTEREST_LIMITS } from './interests.schema.js';

// Build a unique key for an interest entry.
function interestKey(regionId, zoneId) {
  return regionId + ':' + (zoneId === null || zoneId === undefined ? 'null' : zoneId);
}

// Validate interest constraints before saving.
function validateInterestConstraints(interests) {
  // Track distinct regions and zones per region.
  const regionSet = new Set();
  const zonesPerRegion = {};
  const broadRegions = new Set();
  const zoneRegions = new Set();

  for (const entry of interests) {
    // Count distinct regions.
    regionSet.add(entry.region_id);

    // Track zones per region.
    if (!zonesPerRegion[entry.region_id]) {
      zonesPerRegion[entry.region_id] = new Set();
    }

    if (entry.zone_id !== null && entry.zone_id !== undefined) {
      zonesPerRegion[entry.region_id].add(entry.zone_id);
      zoneRegions.add(entry.region_id);
    } else {
      broadRegions.add(entry.region_id);
    }
  }

  // Enforce max regions.
  if (regionSet.size > INTEREST_LIMITS.MAX_REGIONS) {
    throw new ApiError(
      422,
      'INTEREST_LIMIT_EXCEEDED',
      'Maximum ' + INTEREST_LIMITS.MAX_REGIONS + ' regions allowed.'
    );
  }

  // Enforce max zones per region.
  for (const regionId of Object.keys(zonesPerRegion)) {
    if (zonesPerRegion[regionId].size > INTEREST_LIMITS.MAX_ZONES_PER_REGION) {
      throw new ApiError(
        422,
        'INTEREST_LIMIT_EXCEEDED',
        'Maximum ' + INTEREST_LIMITS.MAX_ZONES_PER_REGION + ' zones per region allowed.'
      );
    }
  }

  // Enforce no broad interest for a region that also has zone interests.
  for (const regionId of broadRegions) {
    if (zoneRegions.has(regionId)) {
      throw new ApiError(
        422,
        'BROAD_WITH_ZONES_NOT_ALLOWED',
        'A region cannot have both a broad interest and specific zone interests.'
      );
    }
  }
}

// Validate that all zones belong to their stated regions.
async function validateZoneParentage(interests) {
  // Collect zone entries that need validation.
  const zoneEntries = interests.filter(
    (entry) => entry.zone_id !== null && entry.zone_id !== undefined
  );

  if (zoneEntries.length === 0) {
    return;
  }

  // Build a lookup of zone_id -> expected region_id.
  const zoneToExpectedRegion = {};
  for (const entry of zoneEntries) {
    zoneToExpectedRegion[entry.zone_id] = entry.region_id;
  }

  // Fetch actual zone-region mappings.
  const zoneIds = Object.keys(zoneToExpectedRegion).map(Number);
  const placeholders = zoneIds.map(() => '?').join(', ');

  const [rows] = await pool.query(
    'SELECT id, region_id, is_active FROM zones WHERE id IN (' + placeholders + ')',
    zoneIds
  );

  // Build a map of zone_id -> actual region_id.
  const zoneMap = {};
  for (const row of rows) {
    zoneMap[row.id] = { region_id: row.region_id, is_active: row.is_active };
  }

  // Validate each zone entry.
  for (const entry of zoneEntries) {
    const zoneInfo = zoneMap[entry.zone_id];

    // Zone must exist.
    if (!zoneInfo) {
      throw new ApiError(404, 'NOT_FOUND', 'Zone not found.');
    }

    // Zone must be active.
    if (!zoneInfo.is_active) {
      throw new ApiError(422, 'ZONE_REGION_MISMATCH', 'Selected zone is inactive.');
    }

    // Zone must belong to the stated region.
    if (zoneInfo.region_id !== entry.region_id) {
      throw new ApiError(
        422,
        'ZONE_REGION_MISMATCH',
        'Selected zone does not belong to the selected region.'
      );
    }
  }

  // Also validate that all referenced regions are active.
  const regionIds = [...new Set(interests.map((entry) => entry.region_id))];
  const regionPlaceholders = regionIds.map(() => '?').join(', ');

  const [regionRows] = await pool.query(
    'SELECT id, is_active FROM regions WHERE id IN (' + regionPlaceholders + ')',
    regionIds
  );

  const regionMap = {};
  for (const row of regionRows) {
    regionMap[row.id] = row.is_active;
  }

  for (const regionId of regionIds) {
    if (regionMap[regionId] === undefined) {
      throw new ApiError(404, 'NOT_FOUND', 'Region not found.');
    }
    if (!regionMap[regionId]) {
      throw new ApiError(422, 'ZONE_REGION_MISMATCH', 'Selected region is inactive.');
    }
  }
}

// Get the authenticated user's transfer interests.
export async function getMyInterests(userId) {
  const [rows] = await pool.query(
    'SELECT ' +
    'ti.id, ' +
    'ti.region_id, ' +
    'ti.zone_id, ' +
    'ti.created_at, ' +
    'r.name_en AS region_name, ' +
    'r.name_am AS region_name_am, ' +
    'z.name_en AS zone_name, ' +
    'z.name_am AS zone_name_am ' +
    'FROM transfer_interests ti ' +
    'JOIN regions r ON r.id = ti.region_id ' +
    'LEFT JOIN zones z ON z.id = ti.zone_id ' +
    'WHERE ti.user_id = ? ' +
    'ORDER BY ti.created_at ASC',
    [userId]
  );

  // Count distinct regions.
  const regionSet = new Set(rows.map((row) => row.region_id));

  // Serialize interests.
  const interests = rows.map((row) => ({
    id: row.id,
    region_id: row.region_id,
    region_name: row.region_name,
    region_name_am: row.region_name_am,
    zone_id: row.zone_id,
    zone_name: row.zone_name,
    zone_name_am: row.zone_name_am,
    created_at: row.created_at
  }));

  return {
    interests,
    selected_region_count: regionSet.size
  };
}

// Get interest options for a region with selected state.
export async function getOptions(userId, regionId) {
  // If no region specified, use the user's home region.
  let targetRegionId = regionId;
  let isHomeRegion = false;

  if (!targetRegionId) {
    const [userRows] = await pool.query(
      'SELECT region_id FROM users WHERE id = ?',
      [userId]
    );

    if (!userRows[0]) {
      throw new ApiError(404, 'NOT_FOUND', 'User not found.');
    }

    targetRegionId = userRows[0].region_id;
    isHomeRegion = true;
  } else {
    // Check if the requested region is the user's home region.
    const [userRows] = await pool.query(
      'SELECT region_id FROM users WHERE id = ?',
      [userId]
    );

    if (userRows[0] && userRows[0].region_id === targetRegionId) {
      isHomeRegion = true;
    }
  }

  // Fetch region info.
  const [regionRows] = await pool.query(
    'SELECT id, name_en, name_am FROM regions WHERE id = ? AND is_active = TRUE',
    [targetRegionId]
  );

  if (!regionRows[0]) {
    throw new ApiError(404, 'NOT_FOUND', 'Region not found or inactive.');
  }

  const region = regionRows[0];

  // Fetch active zones for this region.
  const [zoneRows] = await pool.query(
    'SELECT id, name_en, name_am FROM zones WHERE region_id = ? AND is_active = TRUE ORDER BY id ASC',
    [targetRegionId]
  );

  // Fetch user's current interests for this region.
  const [interestRows] = await pool.query(
    'SELECT zone_id FROM transfer_interests WHERE user_id = ? AND region_id = ?',
    [userId, targetRegionId]
  );

  // Build a set of selected zone IDs (null means broad).
  const selectedZoneIds = new Set();
  let hasBroad = false;

  for (const row of interestRows) {
    if (row.zone_id === null) {
      hasBroad = true;
    } else {
      selectedZoneIds.add(row.zone_id);
    }
  }

  // Serialize zones with selected state.
  const zones = zoneRows.map((zone) => ({
    id: zone.id,
    name: zone.name_en,
    name_am: zone.name_am,
    selected: selectedZoneIds.has(zone.id)
  }));

  // Count total active interests for the user.
  const [countRows] = await pool.query(
    'SELECT COUNT(*) AS count FROM transfer_interests WHERE user_id = ?',
    [userId]
  );

  return {
    region: {
      id: region.id,
      name: region.name_en,
      name_am: region.name_am
    },
    is_user_home_region: isHomeRegion,
    has_broad_interest: hasBroad,
    zones,
    current_selection_count: Number(countRows[0].count),
    limits: {
      max_regions: INTEREST_LIMITS.MAX_REGIONS,
      max_zones_per_region: INTEREST_LIMITS.MAX_ZONES_PER_REGION
    }
  };
}

// Save interests using diff-based bulk replace.
export async function saveInterests(userId, interests, context = {}) {
  // Validate constraints before touching the database.
  validateInterestConstraints(interests);

  // Validate zone parentage and active status.
  await validateZoneParentage(interests);

  // Fetch existing interests.
  const [existingRows] = await pool.query(
    'SELECT id, region_id, zone_id FROM transfer_interests WHERE user_id = ?',
    [userId]
  );

  // Build maps for diffing.
  const existingMap = {};
  for (const row of existingRows) {
    const key = interestKey(row.region_id, row.zone_id);
    existingMap[key] = row.id;
  }

  const newKeySet = new Set();
  for (const entry of interests) {
    const key = interestKey(entry.region_id, entry.zone_id);
    newKeySet.add(key);
  }

  // Determine what to delete, insert, and keep.
  const toDelete = [];
  const toInsert = [];

  // Existing entries not in the new set should be deleted.
  for (const row of existingRows) {
    const key = interestKey(row.region_id, row.zone_id);
    if (!newKeySet.has(key)) {
      toDelete.push(row.id);
    }
  }

  // New entries not in the existing set should be inserted.
  for (const entry of interests) {
    const key = interestKey(entry.region_id, entry.zone_id);
    if (!(key in existingMap)) {
      toInsert.push(entry);
    }
  }

  // Apply changes in a transaction.
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Delete removed interests.
    for (const id of toDelete) {
      await connection.query(
        'DELETE FROM transfer_interests WHERE id = ? AND user_id = ?',
        [id, userId]
      );
    }

    // Insert new interests.
    for (const entry of toInsert) {
      await connection.query(
        'INSERT INTO transfer_interests (user_id, region_id, zone_id) VALUES (?, ?, ?)',
        [userId, entry.region_id, entry.zone_id === undefined ? null : entry.zone_id]
      );
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  // Count total active interests after save.
  const [countRows] = await pool.query(
    'SELECT COUNT(*) AS count FROM transfer_interests WHERE user_id = ?',
    [userId]
  );

  // Audit the save action.
  await writeAudit({
    actorType: 'user',
    actorId: userId,
    action: 'user_interests_save',
    entityType: 'transfer_interest',
    entityId: null,
    metadata: Object.assign(
      {
        total_interests: Number(countRows[0].count),
        inserted: toInsert.length,
        deleted: toDelete.length
      },
      context
    )
  });

  return {
    saved: true,
    total_active_interests: Number(countRows[0].count)
  };
}

// Delete a single interest by ID.
export async function deleteInterest(userId, interestId, context = {}) {
  // Verify the interest belongs to the user.
  const [rows] = await pool.query(
    'SELECT id FROM transfer_interests WHERE id = ? AND user_id = ?',
    [interestId, userId]
  );

  if (!rows[0]) {
    throw new ApiError(404, 'NOT_FOUND', 'Interest not found.');
  }

  // Delete the interest.
  await pool.query('DELETE FROM transfer_interests WHERE id = ?', [interestId]);

  // Audit the delete action.
  await writeAudit({
    actorType: 'user',
    actorId: userId,
    action: 'user_interest_delete',
    entityType: 'transfer_interest',
    entityId: interestId,
    metadata: context
  });

  return {
    deleted_id: interestId
  };
}
