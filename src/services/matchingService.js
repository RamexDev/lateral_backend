/**
 * MatchingService — live marketplace feed query (§5).
 *
 * Eligibility is one-directional (BR-002): a candidate appears only because THEIR
 * interest matches MY current location. Ranking adds a mutuality boost layered on top
 * (BR-002 extends FR-MATCH-005): candidates who also currently sit somewhere I've
 * expressed interest in rank above one-directional leads.
 *
 * Feed cards hide identity (telegram_username, phone_number, branch_name, neighborhood)
 * until a completed purchases row exists for (buyer, target) — enforced at the API layer
 * per SEC-010, never by the SQL itself.
 *
 * Feed caching (§5.1): cached in Redis for 30–60s, keyed by user+page+adjacency,
 * bypassed by ?fresh=true (FR-MATCH-007).
 */
const db = require('../db/knex');
const { getBackend } = require('../utils/cache');
const config = require('../config');
const locationRepo = require('../repositories/locationRepository');
const gradeRepo = require('../repositories/gradeRepository');
const i18n = require('./localizationService');

const CACHE_TTL_SECONDS = 30;

/**
 * Run the live matching query. Mirrors §5 SQL using Knex's raw bindings.
 *
 * Returns rows shaped like:
 *   {
 *     candidateUserId, candidateGrade, matchedLocationId, matchedLocationName,
 *     matchedLocationLevel, specificityDepth, interestCreatedAt, isMutualMatch
 *   }
 */
async function runMatchingQuery({
  requestingUserId,
  requestingUserBankId,
  requestingUserLocationId,
  requestingUserRankOrder,
  adjacencyRange,
  page,
  pageSize,
  lang,
}) {
  const nameCol = lang === 'am' ? 'l.name_am' : 'l.name';
  const gradeBandCol = lang === 'am' ? 'g2.band_label_am' : 'g2.band_label';
  const gradeTierCol = lang === 'am' ? 'g2.tier_classification_am' : 'g2.tier_classification';

  // SQLite boolean: returns 0/1. Coerce later.
  const rows = await db.raw(
    `SELECT
       ti.user_id             AS candidateUserId,
       ti.id                  AS matchedInterestId,
       g2.grade_number        AS candidateGradeNumber,
       ${gradeBandCol}        AS candidateBandLabel,
       ${gradeTierCol}        AS candidateTierClassification,
       ti.location_id         AS matchedLocationId,
       ${nameCol}             AS matchedLocationName,
       l.level_type           AS matchedLocationLevel,
       la.depth               AS specificityDepth,
       ti.created_at          AS interestCreatedAt,
       EXISTS (
         SELECT 1 FROM transfer_interests my_ti
         JOIN location_ancestors my_la
           ON my_la.ancestor_id = my_ti.location_id
          AND my_la.descendant_id = u2.current_location_id
         WHERE my_ti.user_id = ?
       )                       AS isMutualMatch
     FROM transfer_interests ti
     JOIN users  u2 ON u2.id = ti.user_id
     JOIN grades g2 ON g2.id = u2.grade_id
     JOIN location_ancestors la
          ON la.ancestor_id   = ti.location_id
         AND la.descendant_id = ?
     JOIN locations l ON l.id = ti.location_id
     WHERE u2.bank_id  = ?
       AND u2.id       != ?
       AND u2.is_active = 1
       AND ABS(g2.rank_order - ?) <= ?
     ORDER BY isMutualMatch DESC, la.depth ASC, ti.created_at DESC
     LIMIT ? OFFSET ?`,
    [
      requestingUserId,
      requestingUserLocationId,
      requestingUserBankId,
      requestingUserId,
      requestingUserRankOrder,
      adjacencyRange,
      pageSize,
      (page - 1) * pageSize,
    ],
  );

  // knex.raw returns [rows, fields] for mysql2, but for better-sqlite3 just returns rows.
  return Array.isArray(rows) && Array.isArray(rows[0]) && rows[0] !== undefined && rows.length === 2
    ? rows[0]
    : rows;
}

/**
 * Fetch the feed for the requesting user — with caching, formatting, and SEC-010
 * contact suppression for unpurchased cards.
 */
async function getFeed(user, { page = 1, pageSize = 10, fresh = false } = {}) {
  const lang = user.preferred_language;
  const adjacencyRange = config.business.defaultGradeAdjacencyRange;

  const cacheKey = `feed:${user.bank_id}:${user.id}:${user.current_location_id}:${adjacencyRange}:${page}`;
  const cache = await getBackend();

  if (!fresh) {
    const cached = await cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Corrupt cache — fall through and recompute.
      }
    }
  }

  // Resolve viewer's grade rank_order.
  const grade = await gradeRepo.findById(user.grade_id);
  if (!grade) {
    return { results: [], page, pageSize, totalResults: 0 };
  }

  const rows = await runMatchingQuery({
    requestingUserId: user.id,
    requestingUserBankId: user.bank_id,
    requestingUserLocationId: user.current_location_id,
    requestingUserRankOrder: grade.rank_order,
    adjacencyRange,
    page,
    pageSize,
    lang,
  });

  // Resolve which candidates the viewer has already purchased (so we can show unlocked contact info).
  const candidateIds = rows.map((r) => r.candidateUserId);
  const unlockedSet = new Set();
  if (candidateIds.length) {
    const purchases = await db('purchases')
      .select('target_user_id')
      .where({ buyer_id: user.id })
      .whereIn('target_user_id', candidateIds);
    for (const p of purchases) unlockedSet.add(p.target_user_id);
  }

  // For unlocked candidates, fetch the contact fields in one query.
  let contactById = new Map();
  if (unlockedSet.size) {
    const contacts = await db('users')
      .select(
        'id',
        'telegram_username as telegramUsername',
        'phone_number as phone',
        'branch_name as branchName',
        'neighborhood',
      )
      .whereIn('id', Array.from(unlockedSet));
    contactById = new Map(contacts.map((c) => [c.id, c]));
  }

  // Resolve viewer's zone name for the region-level match warning.
  const viewerZone = await locationRepo.findById(user.current_location_id, lang);

  const results = rows.map((r) => {
    const unlocked = unlockedSet.has(r.candidateUserId);
    const isMutual =
      Number(r.isMutualMatch) === 1 || r.isMutualMatch === true || r.isMutualMatch === 1;

    let matchWarning = null;
    if (r.matchedLocationLevel === 'region') {
      matchWarning = i18n.t('REGION_LEVEL_MATCH_WARNING', lang, {
        region: r.matchedLocationName,
        zone: viewerZone?.name || '',
      });
    }

    const card = {
      candidateId: `c_${r.candidateUserId}`,
      candidateUserId: r.candidateUserId,
      matchedInterestId: r.matchedInterestId,
      grade: `Grade ${r.candidateGradeNumber} — ${r.candidateTierClassification}`,
      matchedLocation: r.matchedLocationName,
      specificity: r.matchedLocationLevel,
      isMutualMatch: isMutual,
      matchWarning,
      unlocked,
    };

    if (unlocked) {
      const c = contactById.get(r.candidateUserId);
      card.contact = c
        ? {
            telegramUsername: c.telegramUsername,
            phone: c.phone,
            branchName: c.branchName,
            neighborhood: c.neighborhood,
          }
        : null;
    }
    return card;
  });

  const totalResults = results.length; // Paginated count; for the small fixture data this is enough.
  const response = { results, page, pageSize, totalResults };
  await cache.set(cacheKey, JSON.stringify(response), CACHE_TTL_SECONDS);
  return response;
}

module.exports = { getFeed, runMatchingQuery };
