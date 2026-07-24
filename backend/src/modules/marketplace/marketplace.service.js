// Import MySQL pool.
import { pool } from '../../db/pool.js';
// Import Redis client.
import { redis } from '../../lib/redis.js';
// Import API error class.
import { ApiError } from '../../lib/errors.js';
// Import card serializer.
import { serializeCard } from './cardSerializer.js';
// Import impressions service for viewed_at enrichment.
import { getViewerImpressionMap } from '../impressions/impressions.service.js';
// Import shortlist service for is_shortlisted enrichment.
import { getShortlistSet } from '../shortlist/shortlist.service.js';
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

// Build a stable hash string for cache keying from filter options.
function filterHash(filters) {
  const parts = [];
  parts.push('m=' + (filters.mutual_only ? '1' : '0'));
  if (filters.grade_band !== undefined && filters.grade_band !== null) {
    parts.push('gb=' + filters.grade_band);
  }
  if (filters.region_id) {
    parts.push('r=' + filters.region_id);
  }
  if (filters.zone_id) {
    parts.push('z=' + filters.zone_id);
  }
  return parts.join('|');
}

// Build the feed cache key.
function feedCacheKey(bankId, userId, zoneId, page, pageSize, filters) {
  return 'feed:' + bankId + ':' + userId + ':' + zoneId + ':' + page + ':' + pageSize + ':' + filterHash(filters);
}

// Build the people cache key.
function peopleCacheKey(userId, page, pageSize, filters) {
  return 'people:' + userId + ':' + page + ':' + pageSize + ':' + filterHash(filters);
}

// Build extra WHERE clauses from filters. Returns { sql, params }.
function buildFilterClauses(filters, viewerBand) {
  const clauses = [];
  const params = [];

  if (filters.mutual_only) {
    // Only return cards where is_mutual = TRUE.
    // The is_mutual EXISTS subquery is already in the SELECT; we re-add it as a WHERE.
    clauses.push('EXISTS (' +
      'SELECT 1 FROM transfer_interests vti ' +
      'WHERE vti.user_id = ? ' +
      'AND ((vti.zone_id = u.zone_id) OR (vti.zone_id IS NULL AND vti.region_id = u.region_id))' +
      ')');
    // We'll need viewerId here — caller must pass it. Use a placeholder.
    // Actually we restructure: caller passes viewerId in filters object.
  }

  if (filters.grade_band !== undefined && filters.grade_band !== null) {
    // Filter to a specific band ±1.
    // Note: this overrides the default ±1 viewer band filter.
    // We use a HAVING-style clause via ABS().
    clauses.push('ABS(CAST(ug.band_number AS SIGNED) - ?) <= 1');
    params.push(Number(filters.grade_band));
  }

  if (filters.region_id) {
    clauses.push('u.region_id = ?');
    params.push(Number(filters.region_id));
  }

  if (filters.zone_id) {
    clauses.push('u.zone_id = ?');
    params.push(Number(filters.zone_id));
  }

  return { sql: clauses, params };
}

// Get the marketplace feed for the authenticated viewer.
export async function getFeed(viewerId, { page, pageSize, fresh, filters = {} }) {
  const viewer = await getViewerContext(viewerId);

  const cacheKey = feedCacheKey(viewer.bank_id, viewerId, viewer.zone_id, page, pageSize, filters);
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

  // Build the base filter clauses.
  // Default ±1 band filter is always applied; additional filters are layered on top.
  // For mutual_only filter, we need viewerId in the filter params.
  const extraClauses = [];
  const extraParams = [];

  if (filters.mutual_only) {
    extraClauses.push('EXISTS (' +
      'SELECT 1 FROM transfer_interests ti_cand ' +
      'WHERE ti_cand.user_id = u.id ' +
      'AND ((ti_cand.zone_id = ?) OR (ti_cand.zone_id IS NULL AND ti_cand.region_id = ?))' +
      ')');
    extraParams.push(viewer.zone_id);
    extraParams.push(viewer.region_id);

    extraClauses.push('EXISTS (' +
      'SELECT 1 FROM transfer_interests vti ' +
      'WHERE vti.user_id = ? ' +
      'AND ((vti.zone_id = u.zone_id) OR (vti.zone_id IS NULL AND vti.region_id = u.region_id))' +
      ')');
    extraParams.push(viewerId);
  }

  // grade_band filter overrides the default ±1 viewer band filter.
  const bandFilterValue = (filters.grade_band !== undefined && filters.grade_band !== null)
    ? Number(filters.grade_band)
    : viewer.viewer_band;

  if (filters.region_id) {
    extraClauses.push('u.region_id = ?');
    extraParams.push(Number(filters.region_id));
  }

  if (filters.zone_id) {
    extraClauses.push('u.zone_id = ?');
    extraParams.push(Number(filters.zone_id));
  }

  const extraClauseSql = extraClauses.length > 0 ? ' AND ' + extraClauses.join(' AND ') : '';

  // Feed query: all bank-mates ordered by relevance.
  // Relevance order: mutual interest > they want my area > same bank only.
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
    // Compute band_delta for relevance scoring (NULL when viewer band is unknown).
    'ABS(CAST(ug.band_number AS SIGNED) - ?) AS band_delta, ' +
    // Does the candidate want to come to the viewer's area?
    '( ' +
    '  SELECT CASE WHEN ti.zone_id IS NOT NULL THEN \'zone\' ELSE \'region\' END ' +
    '  FROM transfer_interests ti ' +
    '  WHERE ti.user_id = u.id ' +
    '    AND ((ti.zone_id = ?) OR (ti.zone_id IS NULL AND ti.region_id = ?)) ' +
    '  ORDER BY ti.zone_id IS NOT NULL DESC ' +
    '  LIMIT 1 ' +
    ') AS match_type, ' +
    // Does the viewer want the candidate's area?
    'EXISTS (' +
    '  SELECT 1 FROM transfer_interests vti ' +
    '  WHERE vti.user_id = ? ' +
    '  AND ((vti.zone_id = u.zone_id) OR (vti.zone_id IS NULL AND vti.region_id = u.region_id)) ' +
    ') AS is_mutual ' +
    'FROM users u ' +
    'JOIN grades ug ON ug.id = u.grade_id ' +
    'JOIN regions r ON r.id = u.region_id ' +
    'JOIN zones z ON z.id = u.zone_id ' +
    'WHERE u.bank_id = ? ' +
    '  AND u.id != ? ' +
    '  AND u.is_active = TRUE ' +
    '  AND u.profile_completed_at IS NOT NULL ' +
    '  AND ABS(CAST(ug.band_number AS SIGNED) - ?) <= 1' +
    extraClauseSql + ' ' +
    'ORDER BY is_mutual DESC, ' +
    '  CASE WHEN match_type = \'zone\' THEN 2 WHEN match_type = \'region\' THEN 1 ELSE 0 END DESC, ' +
    '  ABS(CAST(ug.band_number AS SIGNED) - ?) ASC, ' +
    '  u.profile_completed_at DESC ' +
    'LIMIT ? OFFSET ?';

  let rows;
  try {
    [rows] = await pool.query(feedSql, [
      viewer.viewer_band,         // 1: band_delta in SELECT
      viewer.zone_id,             // 2: match_type subquery ti.zone_id = ?
      viewer.region_id,           // 3: match_type subquery ti.region_id = ?
      viewerId,                   // 4: is_mutual EXISTS in SELECT
      viewer.bank_id,             // 5: WHERE bank
      viewerId,                   // 6: WHERE not self
      bandFilterValue,            // 7: WHERE band ±1
      ...extraParams,             // additional filter params
      bandFilterValue,            // ORDER BY band_delta
      pageSize,
      offset
    ]);
  } catch (err) {
    logger.error({ err, viewerId }, 'Feed SQL query failed');
    throw err;
  }

  // Count total candidates (all bank-mates, not just interest-matching).
  const countSql =
    'SELECT COUNT(*) AS total ' +
    'FROM users u ' +
    'JOIN grades ug ON ug.id = u.grade_id ' +
    'WHERE u.bank_id = ? ' +
    '  AND u.id != ? ' +
    '  AND u.is_active = TRUE ' +
    '  AND u.profile_completed_at IS NOT NULL ' +
    '  AND ABS(CAST(ug.band_number AS SIGNED) - ?) <= 1' +
    extraClauseSql;

  const [countRows] = await pool.query(countSql, [
    viewer.bank_id,
    viewerId,
    bandFilterValue,
    ...extraParams
  ]);
  const totalResults = Number(countRows[0].total);

  const candidateIds = rows.map((row) => row.id);
  const purchasedSet = await getPurchasedSet(viewerId, candidateIds);
  const impressionMap = await getViewerImpressionMap(viewerId, candidateIds);
  const shortlistSet = await getShortlistSet(viewerId, candidateIds);

  const results = rows.map((row) => serializeCard(row, purchasedSet, {
    impressionMap,
    shortlistSet,
    viewerBand: viewer.viewer_band
  }));

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
export async function getPeople(viewerId, { page, pageSize, fresh, filters = {} }) {
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

  if (!fresh) {
    const cacheKey = peopleCacheKey(viewerId, page, pageSize, filters);
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

  // Build extra filter clauses.
  const extraClauses = [];
  const extraParams = [];

  if (filters.mutual_only) {
    extraClauses.push('EXISTS (' +
      'SELECT 1 FROM transfer_interests vti2 ' +
      'WHERE vti2.user_id = ? ' +
      'AND ((vti2.zone_id = u.zone_id) OR (vti2.zone_id IS NULL AND vti2.region_id = u.region_id))' +
      ')');
    extraParams.push(viewerId);
  }

  const bandFilterValue = (filters.grade_band !== undefined && filters.grade_band !== null)
    ? Number(filters.grade_band)
    : viewer.viewer_band;

  if (filters.region_id) {
    extraClauses.push('u.region_id = ?');
    extraParams.push(Number(filters.region_id));
  }

  if (filters.zone_id) {
    extraClauses.push('u.zone_id = ?');
    extraParams.push(Number(filters.zone_id));
  }

  const extraClauseSql = extraClauses.length > 0 ? ' AND ' + extraClauses.join(' AND ') : '';

  // People query: candidates located in the viewer's desired areas.
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
    'ABS(CAST(ug.band_number AS SIGNED) - ?) AS band_delta, ' +
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
    '  )' +
    extraClauseSql + ' ' +
    'ORDER BY ABS(CAST(ug.band_number AS SIGNED) - ?) ASC, u.profile_completed_at DESC ' +
    'LIMIT ? OFFSET ?';

  const [rows] = await pool.query(peopleSql, [
    viewer.viewer_band,         // for band_delta in SELECT
    viewerId,                   // for is_mutual EXISTS in SELECT
    viewerId,                   // for match_type CASE in SELECT
    viewer.bank_id,             // WHERE
    viewerId,                   // WHERE u.id != ?
    bandFilterValue,            // WHERE band ±1
    viewerId,                   // WHERE EXISTS for viewer interests
    ...extraParams,             // additional filter params
    bandFilterValue,            // ORDER BY ABS(...)
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
    '  )' +
    extraClauseSql;

  const [countRows] = await pool.query(countSql, [
    viewer.bank_id,
    viewerId,
    bandFilterValue,
    viewerId,
    ...extraParams
  ]);
  const totalResults = Number(countRows[0].total);

  const candidateIds = rows.map((row) => row.id);
  const purchasedSet = await getPurchasedSet(viewerId, candidateIds);
  const impressionMap = await getViewerImpressionMap(viewerId, candidateIds);
  const shortlistSet = await getShortlistSet(viewerId, candidateIds);

  const results = rows.map((row) => serializeCard(row, purchasedSet, {
    impressionMap,
    shortlistSet,
    viewerBand: viewer.viewer_band
  }));

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
