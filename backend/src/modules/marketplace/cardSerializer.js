// Serialize a candidate row into the API card contract.
// Paywalled fields are returned as "*" for unpurchased candidates.
// Photo is always public and never masked (FR-PHOTO-007).
// The frontend renders whatever the API returns — no client-side paywall logic.

// Mask a value: return "*" if not purchased, otherwise the real value.
function mask(value, purchased) {
  if (purchased) {
    return value !== null && value !== undefined ? value : null;
  }
  return '*';
}

// Compute a relevance score (0-100) for a card based on match signals.
// Scoring rubric:
//   - is_mutual: +40 (highest signal — both parties want each other's area)
//   - match_type === 'zone': +30 (zone-level match is more specific than region)
//   - match_type === 'region': +15 (region-level match is broader but still relevant)
//   - grade proximity: up to +15 (closer grade band = better lateral fit)
//     We compute this from the row's band_number vs the viewer's band, but the
//     serializer doesn't always have viewer_band. When not provided, default to
//     +15 (assume the marketplace query already filtered to ±1 band, so the
//     minimum proximity is 0 bands away = full 15 pts). When the row carries
//     a `band_delta` field (computed by the service), use it directly.
function computeRelevanceScore(row, viewerBand) {
  let score = 0;

  if (row.is_mutual) {
    score += 40;
  }

  if (row.match_type === 'zone') {
    score += 30;
  } else if (row.match_type === 'region') {
    score += 15;
  }

  // Grade proximity.
  if (row.band_delta !== undefined && row.band_delta !== null) {
    // band_delta is 0 (same band) or 1 (adjacent band). Map to 15 / 7 points.
    const delta = Number(row.band_delta);
    score += delta === 0 ? 15 : (delta === 1 ? 7 : 0);
  } else if (row.band_number !== undefined && row.band_number !== null && viewerBand) {
    const delta = Math.abs(Number(row.band_number) - Number(viewerBand));
    score += delta === 0 ? 15 : (delta === 1 ? 7 : 0);
  } else {
    // No info — assume best case (marketplace query already enforced ±1).
    score += 15;
  }

  return Math.min(100, Math.max(0, score));
}

// Serialize a single candidate row into the card contract.
// Options:
//   - purchasedSet: Set<userId> of candidates the viewer has purchased.
//   - impressionMap: Map<userId, { first_seen_at, view_count }> from card_impressions.
//   - shortlistSet: Set<userId> of candidates the viewer has shortlisted.
//   - viewerBand: number — the viewer's grade band, for relevance scoring.
export function serializeCard(row, purchasedSet, options = {}) {
  const purchasedSet_ = purchasedSet || new Set();
  const impressionMap = options.impressionMap || new Map();
  const shortlistSet = options.shortlistSet || new Set();
  const viewerBand = options.viewerBand;

  // Determine if this candidate has been purchased by the viewer.
  const purchased = purchasedSet_.has(row.id);

  // Determine impression state.
  const impression = impressionMap.get(row.id);
  const viewedAt = impression ? impression.first_seen_at : null;

  // Determine shortlist state.
  const isShortlisted = shortlistSet.has(row.id);

  // Compute relevance score.
  const relevanceScore = computeRelevanceScore(row, viewerBand);

  // Build the card object.
  const card = {
    id: row.id,
    bank_id: row.bank_id,
    grade: {
      band: row.band_number,
      number: row.grade_number,
      band_label_en: row.band_label_en,
      band_label_am: row.band_label_am,
      tier_classification_en: row.tier_classification_en,
      tier_classification_am: row.tier_classification_am
    },
    region: row.region_name_en,
    region_en: row.region_name_en,
    region_am: row.region_name_am,
    zone: row.zone_name_en,
    zone_en: row.zone_name_en,
    zone_am: row.zone_name_am,
    full_name_en: mask(row.full_name_en, purchased),
    full_name_am: mask(row.full_name_am, purchased),
    branch_name_en: mask(row.branch_name_en, purchased),
    branch_name_am: mask(row.branch_name_am, purchased),
    neighborhood_en: mask(row.neighborhood_en, purchased),
    neighborhood_am: mask(row.neighborhood_am, purchased),
    phone_number: mask(row.phone_number, purchased),
    telegram_username: mask(row.telegram_username, purchased),
    photo_url: row.photo_url,
    match_type: row.match_type || null,
    is_mutual: Boolean(row.is_mutual),
    purchased,
    // New fields (additive, backward-compatible):
    relevance_score: relevanceScore,
    viewed_at: viewedAt,
    is_shortlisted: isShortlisted
  };

  return card;
}
