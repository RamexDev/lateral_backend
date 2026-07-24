// Card impressions service.
// Tracks which marketplace cards the viewer has seen, enabling "Viewed" tags
// in the UI. Impressions are buyer-side only and never shown to the candidate.

import { pool } from '../../db/pool.js';
import { ApiError } from '../../lib/errors.js';

// Record impressions for a batch of candidate IDs.
// Idempotent: if an impression row already exists, bump view_count + last_seen_at.
// Validates that all candidate IDs belong to the viewer's bank and are complete.
export async function recordImpressions(viewerId, candidateIds) {
  if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
    return { recorded: 0 };
  }

  // Cap batch size to prevent abuse.
  const capped = candidateIds.slice(0, 100);

  // Validate viewer's bank for same-bank constraint.
  const [viewerRows] = await pool.query(
    'SELECT id, bank_id FROM users WHERE id = ? AND is_active = TRUE',
    [viewerId]
  );
  if (!viewerRows[0]) {
    throw new ApiError(404, 'NOT_FOUND', 'Viewer not found or inactive.');
  }
  const viewerBankId = viewerRows[0].bank_id;

  // Fetch viewer's grade band for ±1 filter validation.
  // (We only record impressions for cards the viewer could legitimately see.)
  // Note: we trust the client here — the marketplace endpoints already enforce
  // the matching rules; this endpoint just records what was sent.

  // Fetch valid candidates: same bank, complete, active, not the viewer.
  const placeholders = capped.map(() => '?').join(', ');
  const [candidateRows] = await pool.query(
    'SELECT id FROM users WHERE id IN (' + placeholders + ') ' +
    'AND bank_id = ? AND is_active = TRUE AND profile_completed_at IS NOT NULL AND id != ?',
    [...capped, viewerBankId, viewerId]
  );

  const validIds = candidateRows.map((row) => row.id);
  if (validIds.length === 0) {
    return { recorded: 0 };
  }

  // Upsert each impression. Use INSERT ... ON DUPLICATE KEY UPDATE for atomicity.
  const values = validIds.map((cid) => `(${viewerId}, ${cid})`).join(', ');
  await pool.query(
    'INSERT INTO card_impressions (viewer_id, candidate_id) VALUES ' + values + ' ' +
    'ON DUPLICATE KEY UPDATE view_count = view_count + 1, last_seen_at = NOW()'
  );

  return { recorded: validIds.length };
}

// Get the set of candidate IDs the viewer has impressed upon.
// Used by the card serializer to add `viewed_at` to cards.
export async function getViewerImpressionMap(viewerId, candidateIds) {
  if (candidateIds.length === 0) {
    return new Map();
  }
  const placeholders = candidateIds.map(() => '?').join(', ');
  const [rows] = await pool.query(
    'SELECT candidate_id, first_seen_at, last_seen_at, view_count ' +
    'FROM card_impressions WHERE viewer_id = ? AND candidate_id IN (' + placeholders + ')',
    [viewerId, ...candidateIds]
  );
  const map = new Map();
  for (const row of rows) {
    map.set(row.candidate_id, {
      first_seen_at: row.first_seen_at,
      last_seen_at: row.last_seen_at,
      view_count: row.view_count
    });
  }
  return map;
}
