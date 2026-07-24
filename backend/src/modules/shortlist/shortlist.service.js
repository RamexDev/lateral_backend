// Shortlist service — save-for-later functionality.
// Lets a buyer bookmark a candidate without paying.

import { pool } from '../../db/pool.js';
import { ApiError } from '../../lib/errors.js';
import { writeAudit } from '../../lib/audit.js';

// Get the set of candidate IDs the viewer has shortlisted.
// Used by the card serializer to add `is_shortlisted` to cards.
export async function getShortlistSet(viewerId, candidateIds) {
  if (candidateIds.length === 0) {
    return new Set();
  }
  const placeholders = candidateIds.map(() => '?').join(', ');
  const [rows] = await pool.query(
    'SELECT target_user_id FROM shortlist WHERE user_id = ? AND target_user_id IN (' + placeholders + ')',
    [viewerId, ...candidateIds]
  );
  return new Set(rows.map((row) => row.target_user_id));
}

// Add a candidate to the viewer's shortlist.
// Idempotent: re-shortlisting an already-shortlisted candidate is a no-op.
export async function addShortlist(viewerId, targetUserId, context = {}) {
  if (viewerId === targetUserId) {
    throw new ApiError(400, 'SELF_SHORTLIST', 'You cannot shortlist yourself.');
  }

  // Validate target exists, is active, complete, and same bank.
  const [viewerRows] = await pool.query(
    'SELECT id, bank_id FROM users WHERE id = ? AND is_active = TRUE',
    [viewerId]
  );
  if (!viewerRows[0]) {
    throw new ApiError(404, 'NOT_FOUND', 'Viewer not found or inactive.');
  }

  const [targetRows] = await pool.query(
    'SELECT id, bank_id, is_active, profile_completed_at FROM users WHERE id = ?',
    [targetUserId]
  );
  if (!targetRows[0]) {
    throw new ApiError(404, 'TARGET_NOT_FOUND', 'Candidate not found.');
  }
  if (!targetRows[0].is_active) {
    throw new ApiError(422, 'TARGET_INACTIVE', 'Candidate is no longer active.');
  }
  if (!targetRows[0].profile_completed_at) {
    throw new ApiError(422, 'TARGET_INACTIVE', 'Candidate profile is incomplete.');
  }
  if (viewerRows[0].bank_id !== targetRows[0].bank_id) {
    throw new ApiError(403, 'CROSS_BANK', 'Cannot shortlist across different banks.');
  }

  // Insert (idempotent via unique constraint).
  try {
    await pool.query(
      'INSERT IGNORE INTO shortlist (user_id, target_user_id) VALUES (?, ?)',
      [viewerId, targetUserId]
    );
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      // Already shortlisted — no-op.
    } else {
      throw err;
    }
  }

  await writeAudit({
    actorType: 'user',
    actorId: viewerId,
    action: 'user_shortlist_add',
    entityType: 'user',
    entityId: targetUserId,
    metadata: context
  });

  return { shortlisted: true, target_user_id: targetUserId };
}

// Remove a candidate from the viewer's shortlist.
// Idempotent: removing a non-shortlisted candidate is a no-op.
export async function removeShortlist(viewerId, targetUserId, context = {}) {
  await pool.query(
    'DELETE FROM shortlist WHERE user_id = ? AND target_user_id = ?',
    [viewerId, targetUserId]
  );

  await writeAudit({
    actorType: 'user',
    actorId: viewerId,
    action: 'user_shortlist_remove',
    entityType: 'user',
    entityId: targetUserId,
    metadata: context
  });

  return { removed: true, target_user_id: targetUserId };
}

// List the viewer's shortlisted candidates with full card data.
// Returns the same card contract as the marketplace endpoints (purchased state included).
import { serializeCard } from '../marketplace/cardSerializer.js';

export async function listShortlist(viewerId, { page, pageSize }) {
  const offset = (page - 1) * pageSize;

  const [rows] = await pool.query(
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
    'sl.created_at AS shortlisted_at, ' +
    // match_type is always null in shortlist context (not a feed match)
    'NULL AS match_type, ' +
    // is_mutual: viewer has interest in candidate's zone/region?
    'EXISTS (' +
    '  SELECT 1 FROM transfer_interests vti ' +
    '  WHERE vti.user_id = ? ' +
    '  AND ((vti.zone_id = u.zone_id) OR (vti.zone_id IS NULL AND vti.region_id = u.region_id)) ' +
    ') AS is_mutual ' +
    'FROM shortlist sl ' +
    'JOIN users u ON u.id = sl.target_user_id ' +
    'JOIN grades ug ON ug.id = u.grade_id ' +
    'JOIN regions r ON r.id = u.region_id ' +
    'JOIN zones z ON z.id = u.zone_id ' +
    'WHERE sl.user_id = ? ' +
    'AND u.is_active = TRUE ' +
    'AND u.profile_completed_at IS NOT NULL ' +
    'ORDER BY sl.created_at DESC ' +
    'LIMIT ? OFFSET ?',
    [viewerId, viewerId, pageSize, offset]
  );

  const [countRows] = await pool.query(
    'SELECT COUNT(*) AS total FROM shortlist sl ' +
    'JOIN users u ON u.id = sl.target_user_id ' +
    'WHERE sl.user_id = ? AND u.is_active = TRUE AND u.profile_completed_at IS NOT NULL',
    [viewerId]
  );
  const totalResults = Number(countRows[0].total);

  const candidateIds = rows.map((row) => row.id);
  const purchasedSet = await getPurchasedSetForShortlist(viewerId, candidateIds);

  // Reuse the marketplace card serializer.
  // All returned rows are shortlisted, so pass them as the shortlistSet.
  const shortlistSet = new Set(candidateIds);
  const results = rows.map((row) => {
    const card = serializeCard(row, purchasedSet, { shortlistSet });
    card.shortlisted_at = row.shortlisted_at;
    return card;
  });

  return {
    results,
    page,
    page_size: pageSize,
    total_results: totalResults
  };
}

// Local helper to avoid circular import with purchases service.
async function getPurchasedSetForShortlist(viewerId, candidateIds) {
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
