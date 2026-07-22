// Import MySQL pool.
import { pool } from '../../db/pool.js';
// Import Redis client.
import { redis } from '../../lib/redis.js';
// Import API error class.
import { ApiError } from '../../lib/errors.js';
// Import card serializer.
import { serializeCard } from './cardSerializer.js';
// Import logger.
import { logger } from '../../lib/logger.js';

// Feed cache TTL in seconds.
const FEED_CACHE_TTL = 30;
// People cache TTL in seconds.
const PEOPLE_CACHE_TTL = 30;

// Fetch the viewer's profile data needed for matching.
async function getViewerContext(userId) {
  const [rows] = await pool.query(
    'SELECT ' +
    'u.id, ' +
    'u.bank_id, ' +
    'u.region_id, ' +
    'u.zone_id, ' +
    'u.grade_id, ' +
    'u.is_active, ' +
    'u.profile_completed_at, ' +
    'g.band_number AS viewer_band ' +
    'FROM users u ' +
    'LEFT JOIN grades g ON g.id = u.grade_id ' +
    'WHERE u.id = ?',
    [userId]
  );
  const viewer = rows[0];
  if (!viewer) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found.');
  }
  if (!viewer.is_active) {
    throw new ApiError(403, 'ACCOUNT_DISABLED', 'Account is disabled.');
  }
  if (!viewer.profile_completed_at) {
    throw new ApiError(403, 'PROFILE_INCOMPLETE', 'Complete your profile to access the marketplace.');
  }
  if (!viewer.grade_id || !viewer.viewer_band) {
    throw new ApiError(403, 'PROFILE_INCOMPLETE', 'Grade is required for marketplace access.');
  }
  return viewer;
}

// Fetch the set of candidate IDs the viewer has already purchased.
async function getPurchasedSet(viewerId, candidateIds) {
  if (candidateIds.length === 0) {
    return new Set();
  }
  const placeholders = candidateIds.map(() => '?').join(', ');
  const [rows] = await pool.query(
    'SELECT target_user_id FROM purchases WHERE buyer_id = ? AND target_user_id IN (' + placeholders + ') AND status = ?',
    [viewerId, ...candidateIds, 'completed']
  );
  return new Set(rows.map((row) => row.target_user_id));
}

// Build the feed cache key.
function feedCacheKey(bankId, userId, zoneId, page, pageSize) {
  return 'feed:' + bankId + ':' + userId + ':' + zoneId + ':' + page + ':' + pageSize;
}

// Build the people cache key.
function peopleCacheKey(userId, page, pageSize) {
  return 'people:' + userId + ':' + page + ':' + pageSize;
}

// Get the marketplace feed for the authenticated viewer.
export async function getFeed(viewerId, { page, pageSize, fresh }) {
  const viewer = await getViewerContext(viewerId);

  const cacheKey = feedCacheKey(viewer.bank_id, viewerId, viewer.zone_id, page, pageSize);
  if (!fresh) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Cache miss on Redis failure.
    }
  }

  const offset = (page - 1) * pageSize;

  // Feed query: candidates who have expressed interest in the viewer's zone or region.
  // CAST(band_number AS SIGNED) prevents UNSIGNED overflow when band < viewer_band.
  const feedSql =
    'SELECT ' +
    'u.id, ' +
    'u.bank_id, ' +
    'u.full_name_en, ' +
    'u.full_name_am, ' +
    'u.branch_name_en, ' +
    'u.branch_name_am, ' +
    'u.neighborhood_en, ' +
    'u.neighborhood_am, ' +
    'u.phone_number, ' +
    'u.telegram_username, ' +
    'u.photo_url, ' +
    'ug.grade_number, ' +
    'ug.band_number, ' +
    'ug.band_label_en, ' +
    'ug.band_label_am, ' +
    'ug.tier_classification_en, ' +
    'ug.tier_classification_am, ' +
    'r.name_en AS region_name_en, ' +
    'r.name_am AS region_name_am, ' +
    'z.name_en AS zone_name_en, ' +
    'z.name_am AS zone_name_am, ' +
    'CASE WHEN ti.zone_id IS NOT NULL THEN \'zone\' ELSE \'region\' END AS match_type, ' +
    'EXISTS (' +
    '  SELECT 1 FROM transfer_interests vti ' +
    '  WHERE vti.user_id = ? ' +
    '  AND ((vti.zone_id = u.zone_id) OR (vti.zone_id IS NULL AND vti.region_id = u.region_id)) ' +
    ') AS is_mutual ' +
    'FROM users u ' +
    'JOIN transfer_interests ti ' +
    '  ON ti.user_id = u.id ' +
    '  AND ((ti.zone_id = ?) OR (ti.zone_id IS NULL AND ti.region_id = ?)) ' +
    'JOIN grades ug ON ug.id = u.grade_id ' +
    'JOIN regions r ON r.id = u.region_id ' +
    'JOIN zones z ON z.id = u.zone_id ' +
    'WHERE u.bank_id = ? ' +
    '  AND u.id != ? ' +
    '  AND u.is_active = TRUE ' +
    '  AND u.profile_completed_at IS NOT NULL ' +
    '  AND ABS(CAST(ug.band_number AS SIGNED) - ?) <= 1 ' +
    'ORDER BY is_mutual DESC, (ti.zone_id IS NOT NULL) DESC, ' +
    '  ABS(CAST(ug.band_number AS SIGNED) - ?) ASC, ' +
    '  ti.created_at DESC ' +
    'LIMIT ? OFFSET ?';

  let rows;
  try {
    [rows] = await pool.query(feedSql, [
      viewerId,
      viewer.zone_id,
      viewer.region_id,
      viewer.bank_id,
      viewerId,
      viewer.viewer_band,
      viewer.viewer_band,
      pageSize,
      offset
    ]);
  } catch (err) {
    logger.error({ err, viewerId }, 'Feed SQL query failed');
    throw err;
  }

  // Count total matching candidates.
  const countSql =
    'SELECT COUNT(DISTINCT u.id) AS total ' +
    'FROM users u ' +
    'JOIN transfer_interests ti ' +
    '  ON ti.user_id = u.id ' +
    '  AND ((ti.zone_id = ?) OR (ti.zone_id IS NULL AND ti.region_id = ?)) ' +
    'JOIN grades ug ON ug.id = u.grade_id ' +
    'WHERE u.bank_id = ? ' +
    '  AND u.id != ? ' +
    '  AND u.is_active = TRUE ' +
    '  AND u.profile_completed_at IS NOT NULL ' +
    '  AND ABS(CAST(ug.band_number AS SIGNED) - ?) <= 1';

  const [countRows] = await pool.query(countSql, [
    viewer.zone_id,
    viewer.region_id,
    viewer.bank_id,
    viewerId,
    viewer.viewer_band
  ]);
  const totalResults = Number(countRows[0].total);

  const candidateIds = rows.map((row) => row.id);
  const purchasedSet = await getPurchasedSet(viewerId, candidateIds);
  const results = rows.map((row) => serializeCard(row, purchasedSet));

  const data = {
    results,
    page,
    page_size: pageSize,
    total_results: totalResults
  };

  try {
    await redis.set(cacheKey, JSON.stringify(data), 'EX', FEED_CACHE_TTL);
  } catch {
    // Ignore cache write failures.
  }

  return data;
}

// Get the people tab for the authenticated viewer.
export async function getPeople(viewerId, { page, pageSize }) {
  const viewer = await getViewerContext(viewerId);

  const [interestCountRows] = await pool.query(
    'SELECT COUNT(*) AS count FROM transfer_interests WHERE user_id = ?',
    [viewerId]
  );
  const interestCount = Number(interestCountRows[0].count);

  if (interestCount === 0) {
    return {
      results: [],
      page,
      page_size: pageSize,
      total_results: 0,
      requires_interests: true
    };
  }

  const cacheKey = peopleCacheKey(viewerId, page, pageSize);
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Cache miss on Redis failure.
  }

  const offset = (page - 1) * pageSize;

  // People query: candidates located in the viewer's desired areas.
  // CAST(band_number AS SIGNED) prevents UNSIGNED overflow.
  const peopleSql =
    'SELECT ' +
    'u.id, ' +
    'u.bank_id, ' +
    'u.full_name_en, ' +
    'u.full_name_am, ' +
    'u.branch_name_en, ' +
    'u.branch_name_am, ' +
    'u.neighborhood_en, ' +
    'u.neighborhood_am, ' +
    'u.phone_number, ' +
    'u.telegram_username, ' +
    'u.photo_url, ' +
    'ug.grade_number, ' +
    'ug.band_number, ' +
    'ug.band_label_en, ' +
    'ug.band_label_am, ' +
    'ug.tier_classification_en, ' +
    'ug.tier_classification_am, ' +
    'r.name_en AS region_name_en, ' +
    'r.name_am AS region_name_am, ' +
    'z.name_en AS zone_name_en, ' +
    'z.name_am AS zone_name_am, ' +
    'EXISTS (' +
    '  SELECT 1 FROM transfer_interests vti ' +
    '  WHERE vti.user_id = ? ' +
    '  AND ((vti.zone_id = u.zone_id) OR (vti.zone_id IS NULL AND vti.region_id = u.region_id)) ' +
    ') AS is_mutual, ' +
    'CASE WHEN EXISTS (' +
    '  SELECT 1 FROM transfer_interests vti2 ' +
    '  WHERE vti2.user_id = ? AND vti2.zone_id = u.zone_id' +
    ') THEN \'zone\' ELSE \'region\' END AS match_type ' +
    'FROM users u ' +
    'JOIN grades ug ON ug.id = u.grade_id ' +
    'JOIN regions r ON r.id = u.region_id ' +
    'JOIN zones z ON z.id = u.zone_id ' +
    'WHERE u.bank_id = ? ' +
    '  AND u.id != ? ' +
    '  AND u.is_active = TRUE ' +
    '  AND u.profile_completed_at IS NOT NULL ' +
    '  AND ABS(CAST(ug.band_number AS SIGNED) - ?) <= 1 ' +
    '  AND EXISTS (' +
    '    SELECT 1 FROM transfer_interests vti ' +
    '    WHERE vti.user_id = ? ' +
    '    AND ((vti.zone_id = u.zone_id) OR (vti.zone_id IS NULL AND vti.region_id = u.region_id)) ' +
    '  ) ' +
    'ORDER BY ABS(CAST(ug.band_number AS SIGNED) - ?) ASC, u.profile_completed_at DESC ' +
    'LIMIT ? OFFSET ?';

  const [rows] = await pool.query(peopleSql, [
    viewerId,
    viewerId,
    viewer.bank_id,
    viewerId,
    viewer.viewer_band,
    viewerId,
    viewer.viewer_band,
    pageSize,
    offset
  ]);

  const countSql =
    'SELECT COUNT(DISTINCT u.id) AS total ' +
    'FROM users u ' +
    'JOIN grades ug ON ug.id = u.grade_id ' +
    'WHERE u.bank_id = ? ' +
    '  AND u.id != ? ' +
    '  AND u.is_active = TRUE ' +
    '  AND u.profile_completed_at IS NOT NULL ' +
    '  AND ABS(CAST(ug.band_number AS SIGNED) - ?) <= 1 ' +
    '  AND EXISTS (' +
    '    SELECT 1 FROM transfer_interests vti ' +
    '    WHERE vti.user_id = ? ' +
    '    AND ((vti.zone_id = u.zone_id) OR (vti.zone_id IS NULL AND vti.region_id = u.region_id)) ' +
    '  )';

  const [countRows] = await pool.query(countSql, [
    viewer.bank_id,
    viewerId,
    viewer.viewer_band,
    viewerId
  ]);
  const totalResults = Number(countRows[0].total);

  const candidateIds = rows.map((row) => row.id);
  const purchasedSet = await getPurchasedSet(viewerId, candidateIds);
  const results = rows.map((row) => serializeCard(row, purchasedSet));

  const data = {
    results,
    page,
    page_size: pageSize,
    total_results: totalResults,
    requires_interests: false
  };

  try {
    await redis.set(cacheKey, JSON.stringify(data), 'EX', PEOPLE_CACHE_TTL);
  } catch {
    // Ignore cache write failures.
  }

  return data;
}
