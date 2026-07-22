// Import MySQL pool.
import { pool } from '../../../db/pool.js';

// Import API error class.
import { ApiError } from '../../../lib/errors.js';

// Import audit helper.
import { writeAudit } from '../../../lib/audit.js';

// Import pagination helpers.
import { getPagination, paginationData } from '../../../lib/pagination.js';

// Import duplicate-entry detector.
import { isDuplicateEntryError } from '../../../lib/dbErrors.js';

// -----------------------------------------------------------------------------
// Serializers
// -----------------------------------------------------------------------------

// Serialize a bank row for API responses.
function bankToApi(row) {
  return {
    id: row.id,
    name: row.name_en,
    name_en: row.name_en,
    name_am: row.name_am,
    nickname: row.alias_en,
    alias_en: row.alias_en,
    alias_am: row.alias_am,
    swift_code: row.swift_code,
    year_established: row.year_established,
    year_established_note: row.year_established_note,
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// Serialize a region row for API responses.
function regionToApi(row) {
  return {
    id: row.id,
    name: row.name_en,
    name_en: row.name_en,
    name_am: row.name_am,
    type: row.type,
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// Serialize a zone row for API responses.
function zoneToApi(row) {
  return {
    id: row.id,
    region_id: row.region_id,
    name: row.name_en,
    name_en: row.name_en,
    name_am: row.name_am,
    note: row.note,
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// Serialize a grade row for API responses.
function gradeToApi(row) {
  return {
    id: row.id,
    grade_number: row.grade_number,
    band_number: row.band_number,
    band_label: row.band_label_en,
    band_label_en: row.band_label_en,
    band_label_am: row.band_label_am,
    tier_classification: row.tier_classification_en,
    tier_classification_en: row.tier_classification_en,
    tier_classification_am: row.tier_classification_am,
    rank_order: row.rank_order,
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// -----------------------------------------------------------------------------
// Row fetch helpers
// -----------------------------------------------------------------------------

// Fetch a bank by ID or throw 404.
async function getBankOr404(id) {
  const [rows] = await pool.query('SELECT * FROM banks WHERE id = ?', [id]);
  if (!rows[0]) {
    throw new ApiError(404, 'NOT_FOUND', 'Bank not found');
  }
  return rows[0];
}

// Fetch a region by ID or throw 404.
async function getRegionOr404(id) {
  const [rows] = await pool.query('SELECT * FROM regions WHERE id = ?', [id]);
  if (!rows[0]) {
    throw new ApiError(404, 'NOT_FOUND', 'Region not found');
  }
  return rows[0];
}

// Fetch a zone by ID or throw 404.
async function getZoneOr404(id) {
  const [rows] = await pool.query('SELECT * FROM zones WHERE id = ?', [id]);
  if (!rows[0]) {
    throw new ApiError(404, 'NOT_FOUND', 'Zone not found');
  }
  return rows[0];
}

// Fetch a grade by ID or throw 404.
async function getGradeOr404(id) {
  const [rows] = await pool.query('SELECT * FROM grades WHERE id = ?', [id]);
  if (!rows[0]) {
    throw new ApiError(404, 'NOT_FOUND', 'Grade not found');
  }
  return rows[0];
}

// -----------------------------------------------------------------------------
// Deactivation guards
// -----------------------------------------------------------------------------

// Block bank deactivation when active users reference it.
async function assertBankCanDeactivate(bankId) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS count FROM users WHERE bank_id = ? AND is_active = TRUE',
    [bankId]
  );

  if (Number(rows[0].count) > 0) {
    throw new ApiError(422, 'BANK_HAS_ACTIVE_USERS', 'Cannot deactivate bank with active users.');
  }
}

// Block region deactivation when active users, zones, or interests reference it.
async function assertRegionCanDeactivate(regionId) {
  const [userRows] = await pool.query(
    'SELECT COUNT(*) AS count FROM users WHERE region_id = ? AND is_active = TRUE',
    [regionId]
  );

  if (Number(userRows[0].count) > 0) {
    throw new ApiError(422, 'REGION_HAS_ACTIVE_USERS', 'Cannot deactivate region with active users.');
  }

  const [zoneRows] = await pool.query(
    'SELECT COUNT(*) AS count FROM zones WHERE region_id = ? AND is_active = TRUE',
    [regionId]
  );

  if (Number(zoneRows[0].count) > 0) {
    throw new ApiError(422, 'REGION_HAS_ACTIVE_USERS', 'Cannot deactivate region with active zones.');
  }

  const [interestRows] = await pool.query(
    'SELECT COUNT(*) AS count ' +
    'FROM transfer_interests ti ' +
    'JOIN users u ON u.id = ti.user_id ' +
    'WHERE ti.region_id = ? AND u.is_active = TRUE',
    [regionId]
  );

  if (Number(interestRows[0].count) > 0) {
    throw new ApiError(422, 'REGION_HAS_ACTIVE_USERS', 'Cannot deactivate region with active transfer interests.');
  }
}

// Block zone deactivation when active users or interests reference it.
async function assertZoneCanDeactivate(zoneId) {
  const [userRows] = await pool.query(
    'SELECT COUNT(*) AS count FROM users WHERE zone_id = ? AND is_active = TRUE',
    [zoneId]
  );

  if (Number(userRows[0].count) > 0) {
    throw new ApiError(422, 'ZONE_HAS_ACTIVE_USERS', 'Cannot deactivate zone with active users.');
  }

  const [interestRows] = await pool.query(
    'SELECT COUNT(*) AS count ' +
    'FROM transfer_interests ti ' +
    'JOIN users u ON u.id = ti.user_id ' +
    'WHERE ti.zone_id = ? AND u.is_active = TRUE',
    [zoneId]
  );

  if (Number(interestRows[0].count) > 0) {
    throw new ApiError(422, 'ZONE_HAS_ACTIVE_USERS', 'Cannot deactivate zone with active transfer interests.');
  }
}

// Block grade deactivation when active users reference it.
async function assertGradeCanDeactivate(gradeId) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS count FROM users WHERE grade_id = ? AND is_active = TRUE',
    [gradeId]
  );

  if (Number(rows[0].count) > 0) {
    throw new ApiError(422, 'GRADE_HAS_ACTIVE_USERS', 'Cannot deactivate grade with active users.');
  }
}

// Ensure a zone belongs to an active region.
async function assertRegionExistsAndActive(regionId) {
  const [rows] = await pool.query('SELECT id, is_active FROM regions WHERE id = ?', [regionId]);

  if (!rows[0]) {
    throw new ApiError(404, 'NOT_FOUND', 'Region not found');
  }

  if (!rows[0].is_active) {
    throw new ApiError(422, 'REGION_INACTIVE', 'Selected region is inactive.');
  }
}

// -----------------------------------------------------------------------------
// Banks
// -----------------------------------------------------------------------------

// List banks with pagination, search, and active filter.
export async function listBanks(query) {
  const pagination = getPagination(query);
  const where = [];
  const params = [];

  if (query.q) {
    const like = '%' + query.q + '%';
    where.push('(name_en LIKE ? OR name_am LIKE ? OR alias_en LIKE ? OR alias_am LIKE ? OR swift_code LIKE ?)');
    params.push(like, like, like, like, like);
  }

  if (query.is_active !== undefined) {
    where.push('is_active = ?');
    params.push(query.is_active);
  }

  const whereSql = where.length > 0 ? ' WHERE ' + where.join(' AND ') : '';

  const [rows] = await pool.query(
    'SELECT * FROM banks' + whereSql + ' ORDER BY id ASC LIMIT ? OFFSET ?',
    params.concat([pagination.limit, pagination.offset])
  );

  const [countRows] = await pool.query(
    'SELECT COUNT(*) AS total FROM banks' + whereSql,
    params
  );

  return paginationData(rows.map(bankToApi), countRows[0].total, pagination);
}

// Create a bank.
export async function createBank(input, actor) {
  try {
    const [result] = await pool.query(
      'INSERT INTO banks (' +
      'name_en, name_am, alias_en, alias_am, swift_code, year_established, year_established_note, is_active' +
      ') VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.name_en,
        input.name_am,
        input.alias_en,
        input.alias_am,
        input.swift_code === undefined ? null : input.swift_code,
        input.year_established === undefined ? null : input.year_established,
        input.year_established_note === undefined ? null : input.year_established_note,
        input.is_active === undefined ? true : input.is_active
      ]
    );

    const row = await getBankOr404(result.insertId);

    await writeAudit({
      actorType: 'staff',
      actorId: actor.id,
      action: 'admin_bank_create',
      entityType: 'bank',
      entityId: row.id,
      metadata: { alias_en: row.alias_en }
    });

    return bankToApi(row);
  } catch (err) {
    if (isDuplicateEntryError(err)) {
      throw new ApiError(409, 'DUPLICATE_ENTRY', 'Bank alias already exists.');
    }
    throw err;
  }
}

// Update a bank.
export async function updateBank(id, input, actor) {
  const existing = await getBankOr404(id);

  if (input.is_active === false && existing.is_active) {
    await assertBankCanDeactivate(id);
  }

  const sets = [];
  const params = [];

  if (input.name_en !== undefined) {
    sets.push('name_en = ?');
    params.push(input.name_en);
  }

  if (input.name_am !== undefined) {
    sets.push('name_am = ?');
    params.push(input.name_am);
  }

  if (input.alias_en !== undefined) {
    sets.push('alias_en = ?');
    params.push(input.alias_en);
  }

  if (input.alias_am !== undefined) {
    sets.push('alias_am = ?');
    params.push(input.alias_am);
  }

  if (input.swift_code !== undefined) {
    sets.push('swift_code = ?');
    params.push(input.swift_code);
  }

  if (input.year_established !== undefined) {
    sets.push('year_established = ?');
    params.push(input.year_established);
  }

  if (input.year_established_note !== undefined) {
    sets.push('year_established_note = ?');
    params.push(input.year_established_note);
  }

  if (input.is_active !== undefined) {
    sets.push('is_active = ?');
    params.push(input.is_active);
  }

  if (sets.length === 0) {
    return bankToApi(existing);
  }

  params.push(id);

  try {
    await pool.query('UPDATE banks SET ' + sets.join(', ') + ' WHERE id = ?', params);
  } catch (err) {
    if (isDuplicateEntryError(err)) {
      throw new ApiError(409, 'DUPLICATE_ENTRY', 'Bank alias already exists.');
    }
    throw err;
  }

  const row = await getBankOr404(id);

  await writeAudit({
    actorType: 'staff',
    actorId: actor.id,
    action: 'admin_bank_update',
    entityType: 'bank',
    entityId: row.id,
    metadata: { is_active: Boolean(row.is_active) }
  });

  return bankToApi(row);
}

// -----------------------------------------------------------------------------
// Regions
// -----------------------------------------------------------------------------

// List regions.
export async function listRegions(query) {
  const pagination = getPagination(query);
  const where = [];
  const params = [];

  if (query.q) {
    const like = '%' + query.q + '%';
    where.push('(name_en LIKE ? OR name_am LIKE ?)');
    params.push(like, like);
  }

  if (query.is_active !== undefined) {
    where.push('is_active = ?');
    params.push(query.is_active);
  }

  const whereSql = where.length > 0 ? ' WHERE ' + where.join(' AND ') : '';

  const [rows] = await pool.query(
    'SELECT * FROM regions' + whereSql + ' ORDER BY id ASC LIMIT ? OFFSET ?',
    params.concat([pagination.limit, pagination.offset])
  );

  const [countRows] = await pool.query(
    'SELECT COUNT(*) AS total FROM regions' + whereSql,
    params
  );

  return paginationData(rows.map(regionToApi), countRows[0].total, pagination);
}

// Create a region.
export async function createRegion(input, actor) {
  const [result] = await pool.query(
    'INSERT INTO regions (name_en, name_am, type, is_active) VALUES (?, ?, ?, ?)',
    [input.name_en, input.name_am, input.type, input.is_active]
  );

  const row = await getRegionOr404(result.insertId);

  await writeAudit({
    actorType: 'staff',
    actorId: actor.id,
    action: 'admin_region_create',
    entityType: 'region',
    entityId: row.id,
    metadata: { name_en: row.name_en }
  });

  return regionToApi(row);
}

// Update a region.
export async function updateRegion(id, input, actor) {
  const existing = await getRegionOr404(id);

  if (input.is_active === false && existing.is_active) {
    await assertRegionCanDeactivate(id);
  }

  const sets = [];
  const params = [];

  if (input.name_en !== undefined) {
    sets.push('name_en = ?');
    params.push(input.name_en);
  }

  if (input.name_am !== undefined) {
    sets.push('name_am = ?');
    params.push(input.name_am);
  }

  if (input.type !== undefined) {
    sets.push('type = ?');
    params.push(input.type);
  }

  if (input.is_active !== undefined) {
    sets.push('is_active = ?');
    params.push(input.is_active);
  }

  if (sets.length === 0) {
    return regionToApi(existing);
  }

  params.push(id);

  await pool.query('UPDATE regions SET ' + sets.join(', ') + ' WHERE id = ?', params);

  const row = await getRegionOr404(id);

  await writeAudit({
    actorType: 'staff',
    actorId: actor.id,
    action: 'admin_region_update',
    entityType: 'region',
    entityId: row.id,
    metadata: { is_active: Boolean(row.is_active) }
  });

  return regionToApi(row);
}

// -----------------------------------------------------------------------------
// Zones
// -----------------------------------------------------------------------------

// List zones.
export async function listZones(query) {
  const pagination = getPagination(query);
  const where = [];
  const params = [];

  if (query.region_id !== undefined) {
    where.push('region_id = ?');
    params.push(query.region_id);
  }

  if (query.q) {
    const like = '%' + query.q + '%';
    where.push('(name_en LIKE ? OR name_am LIKE ?)');
    params.push(like, like);
  }

  if (query.is_active !== undefined) {
    where.push('is_active = ?');
    params.push(query.is_active);
  }

  const whereSql = where.length > 0 ? ' WHERE ' + where.join(' AND ') : '';

  const [rows] = await pool.query(
    'SELECT * FROM zones' + whereSql + ' ORDER BY id ASC LIMIT ? OFFSET ?',
    params.concat([pagination.limit, pagination.offset])
  );

  const [countRows] = await pool.query(
    'SELECT COUNT(*) AS total FROM zones' + whereSql,
    params
  );

  return paginationData(rows.map(zoneToApi), countRows[0].total, pagination);
}

// Create a zone.
export async function createZone(input, actor) {
  await assertRegionExistsAndActive(input.region_id);

  const [result] = await pool.query(
    'INSERT INTO zones (region_id, name_en, name_am, note, is_active) VALUES (?, ?, ?, ?, ?)',
    [
      input.region_id,
      input.name_en,
      input.name_am,
      input.note === undefined ? null : input.note,
      input.is_active
    ]
  );

  const row = await getZoneOr404(result.insertId);

  await writeAudit({
    actorType: 'staff',
    actorId: actor.id,
    action: 'admin_zone_create',
    entityType: 'zone',
    entityId: row.id,
    metadata: { region_id: row.region_id, name_en: row.name_en }
  });

  return zoneToApi(row);
}

// Update a zone.
export async function updateZone(id, input, actor) {
  const existing = await getZoneOr404(id);

  if (input.region_id !== undefined) {
    await assertRegionExistsAndActive(input.region_id);
  }

  if (input.is_active === false && existing.is_active) {
    await assertZoneCanDeactivate(id);
  }

  const sets = [];
  const params = [];

  if (input.region_id !== undefined) {
    sets.push('region_id = ?');
    params.push(input.region_id);
  }

  if (input.name_en !== undefined) {
    sets.push('name_en = ?');
    params.push(input.name_en);
  }

  if (input.name_am !== undefined) {
    sets.push('name_am = ?');
    params.push(input.name_am);
  }

  if (input.note !== undefined) {
    sets.push('note = ?');
    params.push(input.note);
  }

  if (input.is_active !== undefined) {
    sets.push('is_active = ?');
    params.push(input.is_active);
  }

  if (sets.length === 0) {
    return zoneToApi(existing);
  }

  params.push(id);

  await pool.query('UPDATE zones SET ' + sets.join(', ') + ' WHERE id = ?', params);

  const row = await getZoneOr404(id);

  await writeAudit({
    actorType: 'staff',
    actorId: actor.id,
    action: 'admin_zone_update',
    entityType: 'zone',
    entityId: row.id,
    metadata: { is_active: Boolean(row.is_active) }
  });

  return zoneToApi(row);
}

// -----------------------------------------------------------------------------
// Grades
// -----------------------------------------------------------------------------

// List grades.
export async function listGrades(query) {
  const pagination = getPagination(query);
  const where = [];
  const params = [];

  if (query.q) {
    const like = '%' + query.q + '%';
    const qNumber = Number(query.q);

    if (!Number.isNaN(qNumber)) {
      where.push('(grade_number = ? OR band_label_en LIKE ? OR band_label_am LIKE ? OR tier_classification_en LIKE ? OR tier_classification_am LIKE ?)');
      params.push(qNumber, like, like, like, like);
    } else {
      where.push('(band_label_en LIKE ? OR band_label_am LIKE ? OR tier_classification_en LIKE ? OR tier_classification_am LIKE ?)');
      params.push(like, like, like, like);
    }
  }

  if (query.is_active !== undefined) {
    where.push('is_active = ?');
    params.push(query.is_active);
  }

  const whereSql = where.length > 0 ? ' WHERE ' + where.join(' AND ') : '';

  const [rows] = await pool.query(
    'SELECT * FROM grades' + whereSql + ' ORDER BY rank_order ASC, grade_number ASC LIMIT ? OFFSET ?',
    params.concat([pagination.limit, pagination.offset])
  );

  const [countRows] = await pool.query(
    'SELECT COUNT(*) AS total FROM grades' + whereSql,
    params
  );

  return paginationData(rows.map(gradeToApi), countRows[0].total, pagination);
}

// Create a grade.
export async function createGrade(input, actor) {
  const bandNumber = Math.ceil(input.grade_number / 3);

  try {
    const [result] = await pool.query(
      'INSERT INTO grades (' +
      'grade_number, band_number, band_label_en, band_label_am, tier_classification_en, tier_classification_am, rank_order, is_active' +
      ') VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.grade_number,
        bandNumber,
        input.band_label_en,
        input.band_label_am,
        input.tier_classification_en,
        input.tier_classification_am,
        input.rank_order,
        input.is_active
      ]
    );

    const row = await getGradeOr404(result.insertId);

    await writeAudit({
      actorType: 'staff',
      actorId: actor.id,
      action: 'admin_grade_create',
      entityType: 'grade',
      entityId: row.id,
      metadata: { grade_number: row.grade_number }
    });

    return gradeToApi(row);
  } catch (err) {
    if (isDuplicateEntryError(err)) {
      throw new ApiError(409, 'DUPLICATE_ENTRY', 'Grade number already exists.');
    }
    throw err;
  }
}

// Update a grade.
export async function updateGrade(id, input, actor) {
  const existing = await getGradeOr404(id);

  if (input.is_active === false && existing.is_active) {
    await assertGradeCanDeactivate(id);
  }

  const sets = [];
  const params = [];

  if (input.band_label_en !== undefined) {
    sets.push('band_label_en = ?');
    params.push(input.band_label_en);
  }

  if (input.band_label_am !== undefined) {
    sets.push('band_label_am = ?');
    params.push(input.band_label_am);
  }

  if (input.tier_classification_en !== undefined) {
    sets.push('tier_classification_en = ?');
    params.push(input.tier_classification_en);
  }

  if (input.tier_classification_am !== undefined) {
    sets.push('tier_classification_am = ?');
    params.push(input.tier_classification_am);
  }

  if (input.rank_order !== undefined) {
    sets.push('rank_order = ?');
    params.push(input.rank_order);
  }

  if (input.is_active !== undefined) {
    sets.push('is_active = ?');
    params.push(input.is_active);
  }

  if (sets.length === 0) {
    return gradeToApi(existing);
  }

  params.push(id);

  await pool.query('UPDATE grades SET ' + sets.join(', ') + ' WHERE id = ?', params);

  const row = await getGradeOr404(id);

  await writeAudit({
    actorType: 'staff',
    actorId: actor.id,
    action: 'admin_grade_update',
    entityType: 'grade',
    entityId: row.id,
    metadata: { is_active: Boolean(row.is_active) }
  });

  return gradeToApi(row);
}
