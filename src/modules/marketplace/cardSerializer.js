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

// Serialize a single candidate row into the card contract.
export function serializeCard(row, purchasedSet) {
  // Determine if this candidate has been purchased by the viewer.
  const purchased = purchasedSet.has(row.id);

  // Build the card object following the SRS §5.9 contract exactly.
  return {
    id: row.id,
    bank_id: row.bank_id,
    grade: {
      band: row.band_number,
      number: row.grade_number
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
    purchased
  };
}
