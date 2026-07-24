// Import MySQL pool.
import { pool } from '../../db/pool.js';

// Import environment variables.
import { env } from '../../config/env.js';

// Import API error class.
import { ApiError } from '../../lib/errors.js';

// Import user token signer.
import { signUserAccessToken } from '../../lib/userTokens.js';

// Import Telegram initData verifier.
import { verifyTelegramInitData } from '../../lib/telegramInitData.js';

// Import audit helper.
import { writeAudit } from '../../lib/audit.js';

// Determine whether a user row has a complete profile.
function isProfileCompleteRow(row) {
  const hasFullName = Boolean(row.full_name_en || row.full_name_am);
  const hasBranch = Boolean(row.branch_name_en || row.branch_name_am);
  const hasNeighborhood = Boolean(row.neighborhood_en || row.neighborhood_am);
  const hasActiveGrade = Boolean(row.grade_id && row.grade_is_active);

  return hasFullName && hasBranch && hasNeighborhood && hasActiveGrade;
}

// Fetch a user row with grade active state.
async function fetchProfileRow(userId) {
  const [rows] = await pool.query(
    'SELECT u.*, g.is_active AS grade_is_active ' +
    'FROM users u ' +
    'LEFT JOIN grades g ON g.id = u.grade_id ' +
    'WHERE u.id = ?',
    [userId]
  );

  return rows[0] || null;
}

// Synchronize profile_completed_at with current field state.
async function syncProfileCompletedAt(userId, row) {
  const complete = isProfileCompleteRow(row);

  if (complete && !row.profile_completed_at) {
    await pool.query('UPDATE users SET profile_completed_at = NOW() WHERE id = ?', [userId]);
  }

  if (!complete && row.profile_completed_at) {
    await pool.query('UPDATE users SET profile_completed_at = NULL WHERE id = ?', [userId]);
  }

  return complete;
}

// Exchange Telegram initData for a user JWT.
export async function authTelegram({ init_data }, context = {}) {
  // Verify Telegram initData signature.
  const telegramUser = verifyTelegramInitData(init_data);

  // Find the user by Telegram ID.
  const [rows] = await pool.query(
    'SELECT id, bank_id, is_active, profile_completed_at FROM users WHERE telegram_id = ?',
    [telegramUser.id]
  );

  const user = rows[0];

  // Reject unregistered Telegram users.
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'No account found. Please start via the Telegram bot.');
  }

  // Reject disabled users.
  if (!user.is_active) {
    throw new ApiError(403, 'ACCOUNT_DISABLED', 'Account is disabled.');
  }

  // Update last activity timestamp.
  await pool.query('UPDATE users SET last_activity_at = NOW() WHERE id = ?', [user.id]);

  // Sign user JWT.
  const token = signUserAccessToken(user);

  // Audit Mini App authentication.
  await writeAudit({
    actorType: 'user',
    actorId: user.id,
    action: 'user_auth_telegram',
    entityType: 'user',
    entityId: user.id,
    metadata: context
  });

  // Return auth payload.
  return {
    token,
    user_id: user.id,
    profile_complete: Boolean(user.profile_completed_at)
  };
}

// Issue a user token by Telegram ID.
// This is a non-production helper for bot/gateway flows and local testing.
export async function issueToken({ telegram_id }, context = {}) {
  // Disable this helper in production.
  if (env.NODE_ENV === 'production') {
    throw new ApiError(404, 'NOT_FOUND', 'Not available.');
  }

  // Find user by Telegram ID.
  const [rows] = await pool.query(
    'SELECT id, bank_id, is_active, profile_completed_at FROM users WHERE telegram_id = ?',
    [telegram_id]
  );

  const user = rows[0];

  // Reject unknown users.
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'No account found. Please start via the Telegram bot.');
  }

  // Reject disabled users.
  if (!user.is_active) {
    throw new ApiError(403, 'ACCOUNT_DISABLED', 'Account is disabled.');
  }

  // Sign user JWT.
  const token = signUserAccessToken(user);

  // Audit token issuance.
  await writeAudit({
    actorType: 'system',
    actorId: user.id,
    action: 'user_token_issued',
    entityType: 'user',
    entityId: user.id,
    metadata: context
  });

  // Return token payload.
  return {
    token,
    user_id: user.id,
    profile_complete: Boolean(user.profile_completed_at)
  };
}

// Get the authenticated user's profile.
export async function getMe(userId) {
  const [rows] = await pool.query(
    'SELECT ' +
    'u.id, ' +
    'u.telegram_username, ' +
    'u.phone_number, ' +
    'u.bank_id, ' +
    'u.region_id, ' +
    'u.zone_id, ' +
    'u.grade_id, ' +
    'u.full_name_en, ' +
    'u.full_name_am, ' +
    'u.branch_name_en, ' +
    'u.branch_name_am, ' +
    'u.neighborhood_en, ' +
    'u.neighborhood_am, ' +
    'u.photo_url, ' +
    'u.photo_source, ' +
    'u.preferred_language, ' +
    'u.is_active, ' +
    'u.profile_completed_at, ' +
    'u.created_at, ' +
    'b.name_en AS bank_name_en, ' +
    'b.name_am AS bank_name_am, ' +
    'b.alias_en AS bank_alias_en, ' +
    'r.name_en AS region_name_en, ' +
    'r.name_am AS region_name_am, ' +
    'z.name_en AS zone_name_en, ' +
    'z.name_am AS zone_name_am, ' +
    'g.grade_number, ' +
    'g.band_number, ' +
    'g.band_label_en, ' +
    'g.band_label_am, ' +
    'g.tier_classification_en, ' +
    'g.tier_classification_am, ' +
    'g.is_active AS grade_is_active ' +
    'FROM users u ' +
    'JOIN banks b ON b.id = u.bank_id ' +
    'JOIN regions r ON r.id = u.region_id ' +
    'JOIN zones z ON z.id = u.zone_id ' +
    'LEFT JOIN grades g ON g.id = u.grade_id ' +
    'WHERE u.id = ?',
    [userId]
  );

  const row = rows[0];

  // Reject missing user.
  if (!row) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found.');
  }

  // Serialize profile response.
  // F.10: grade band_label renamed to band_label_en for consistency with /grades.
  // F.11: photo_base_url added for CDN-future-proofing.
  // Import env at top of file is already present.
  return {
    user_id: row.id,
    telegram_username: row.telegram_username,
    phone_number: row.phone_number,
    bank: {
      id: row.bank_id,
      name_en: row.bank_name_en,
      name_am: row.bank_name_am,
      nickname: row.bank_alias_en
    },
    region: {
      id: row.region_id,
      name_en: row.region_name_en,
      name_am: row.region_name_am
    },
    zone: {
      id: row.zone_id,
      name_en: row.zone_name_en,
      name_am: row.zone_name_am
    },
    grade: row.grade_id
      ? {
          id: row.grade_id,
          grade_number: row.grade_number,
          band_number: row.band_number,
          // F.10: aligned with /grades endpoint field name (band_label_en).
          band_label_en: row.band_label_en,
          band_label_am: row.band_label_am,
          tier_classification_en: row.tier_classification_en,
          tier_classification_am: row.tier_classification_am
        }
      : null,
    full_name_en: row.full_name_en,
    full_name_am: row.full_name_am,
    branch_name_en: row.branch_name_en,
    branch_name_am: row.branch_name_am,
    neighborhood_en: row.neighborhood_en,
    neighborhood_am: row.neighborhood_am,
    photo_url: row.photo_url,
    photo_source: row.photo_source,
    // F.11: explicit photo base URL so frontend doesn't have to guess.
    photo_base_url: env.PUBLIC_ASSET_BASE_URL || '',
    preferred_language: row.preferred_language,
    profile_complete: isProfileCompleteRow(row),
    is_active: Boolean(row.is_active),
    created_at: row.created_at
  };
}

// Update the authenticated user's profile.
export async function updateProfile(userId, input, context = {}) {
  // Bank is immutable after registration.
  if (input.bank_id !== undefined) {
    throw new ApiError(422, 'BANK_CHANGE_UNSUPPORTED', 'Bank cannot be changed after registration.');
  }

  // Load existing user.
  const existing = await fetchProfileRow(userId);

  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found.');
  }

  // Validate region/zone consistency when changing location.
  if (input.region_id !== undefined && input.zone_id !== undefined) {
    const [zoneRows] = await pool.query(
      'SELECT z.id ' +
      'FROM zones z ' +
      'JOIN regions r ON r.id = z.region_id ' +
      'WHERE z.id = ? AND z.region_id = ? AND z.is_active = TRUE AND r.is_active = TRUE',
      [input.zone_id, input.region_id]
    );

    if (!zoneRows[0]) {
      throw new ApiError(422, 'ZONE_REGION_MISMATCH', 'Selected zone does not belong to the selected region.');
    }
  }

  // Validate grade when provided and not explicitly cleared.
  if (input.grade_id !== undefined && input.grade_id !== null) {
    const [gradeRows] = await pool.query(
      'SELECT id FROM grades WHERE id = ? AND is_active = TRUE',
      [input.grade_id]
    );

    if (!gradeRows[0]) {
      throw new ApiError(404, 'NOT_FOUND', 'Grade not found or inactive.');
    }
  }

  // Build dynamic update statement.
  const sets = [];
  const params = [];

  // Bilingual text fields.
  const textFields = [
    'full_name_en',
    'full_name_am',
    'branch_name_en',
    'branch_name_am',
    'neighborhood_en',
    'neighborhood_am'
  ];

  // Add text fields when provided.
  for (const field of textFields) {
    if (input[field] !== undefined) {
      sets.push(field + ' = ?');
      params.push(input[field]);
    }
  }

  // Add grade when provided, including explicit null.
  if (input.grade_id !== undefined) {
    sets.push('grade_id = ?');
    params.push(input.grade_id);
  }

  // Add region when provided.
  if (input.region_id !== undefined) {
    sets.push('region_id = ?');
    params.push(input.region_id);
  }

  // Add zone when provided.
  if (input.zone_id !== undefined) {
    sets.push('zone_id = ?');
    params.push(input.zone_id);
  }

  // Add preferred language when provided.
  if (input.preferred_language !== undefined) {
    sets.push('preferred_language = ?');
    params.push(input.preferred_language);
  }

  // Apply update when there is at least one field.
  if (sets.length > 0) {
    params.push(userId);
    await pool.query('UPDATE users SET ' + sets.join(', ') + ' WHERE id = ?', params);
  }

  // Fetch updated row.
  const updated = await fetchProfileRow(userId);

  // Synchronize profile_completed_at.
  const profileComplete = await syncProfileCompletedAt(userId, updated);

  // Audit profile update.
  await writeAudit({
    actorType: 'user',
    actorId: userId,
    action: 'user_profile_update',
    entityType: 'user',
    entityId: userId,
    metadata: Object.assign({ profile_complete: profileComplete }, context)
  });

  // Return update result.
  return {
    updated: true,
    profile_complete: profileComplete
  };
}

// Get profile completeness and nudge state.
export async function getCompleteness(userId) {
  // Load user with grade active state.
  const [rows] = await pool.query(
    'SELECT ' +
    'u.id, ' +
    'u.preferred_language, ' +
    'u.is_active, ' +
    'u.profile_completed_at, ' +
    'u.photo_source, ' +
    'u.full_name_en, ' +
    'u.full_name_am, ' +
    'u.branch_name_en, ' +
    'u.branch_name_am, ' +
    'u.neighborhood_en, ' +
    'u.neighborhood_am, ' +
    'u.grade_id, ' +
    'g.is_active AS grade_is_active ' +
    'FROM users u ' +
    'LEFT JOIN grades g ON g.id = u.grade_id ' +
    'WHERE u.id = ?',
    [userId]
  );

  const user = rows[0];

  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found.');
  }

  // Count transfer interests.
  const [interestRows] = await pool.query(
    'SELECT COUNT(*) AS count FROM transfer_interests WHERE user_id = ?',
    [userId]
  );

  const interestCount = Number(interestRows[0].count);

  // Compute missing required fields.
  const missingRequired = [];

  if (!(user.full_name_en || user.full_name_am)) {
    missingRequired.push('full_name');
  }

  if (!(user.branch_name_en || user.branch_name_am)) {
    missingRequired.push('branch_name');
  }

  if (!(user.neighborhood_en || user.neighborhood_am)) {
    missingRequired.push('neighborhood');
  }

  if (!user.grade_id || !user.grade_is_active) {
    missingRequired.push('grade');
  }

  // Marketplace unlock state.
  const isMarketplaceUnlocked = Boolean(user.is_active) && missingRequired.length === 0;

  // Compute missing encouraged fields.
  const missingEncouraged = [];

  // Add missing bilingual language versions when one language is already filled.
  function addMissingLanguage(fieldName, enValue, amValue) {
    if (enValue && !amValue) {
      missingEncouraged.push(fieldName + '_am');
    }

    if (amValue && !enValue) {
      missingEncouraged.push(fieldName + '_en');
    }
  }

  addMissingLanguage('full_name', user.full_name_en, user.full_name_am);
  addMissingLanguage('branch_name', user.branch_name_en, user.branch_name_am);
  addMissingLanguage('neighborhood', user.neighborhood_en, user.neighborhood_am);

  if (interestCount === 0) {
    missingEncouraged.push('transfer_interest');
  }

  if (user.photo_source !== 'custom') {
    missingEncouraged.push('custom_photo');
  }

  // Fully complete means required complete plus all encouraged signals satisfied.
  const isFullyComplete = isMarketplaceUnlocked && missingEncouraged.length === 0;

  // Determine missing language codes.
  const missingLanguages = missingEncouraged
    .filter((item) => item.endsWith('_en') || item.endsWith('_am'))
    .map((item) => item.slice(-2));

  // Choose nudge message code.
  let messageCode = 'FULLY_COMPLETE';

  if (missingRequired.length > 0) {
    messageCode = 'COMPLETE_PROFILE';
  } else if (missingLanguages.length > 0) {
    if (missingLanguages.includes('en') && missingLanguages.includes('am')) {
      messageCode = 'ADD_MISSING_LANGUAGE';
    } else if (missingLanguages.includes('en')) {
      messageCode = 'ADD_MISSING_LANGUAGE_EN';
    } else {
      messageCode = 'ADD_MISSING_LANGUAGE_AM';
    }
  } else if (missingEncouraged.includes('transfer_interest')) {
    messageCode = 'ADD_TRANSFER_INTEREST';
  } else if (missingEncouraged.includes('custom_photo')) {
    messageCode = 'ADD_CUSTOM_PHOTO';
  }

  // Bilingual nudge messages.
  const messages = {
    COMPLETE_PROFILE: {
      en: 'Complete your profile to unlock the marketplace.',
      am: 'ገበያውን ለመክፈት መገለጫዎን ያሟሉ።'
    },
    ADD_MISSING_LANGUAGE_EN: {
      en: 'Add English name, branch, and neighborhood details.',
      am: 'የእንግሊዝኛ ስም፣ ቅርንጫፍ እና መኖሪያ ሰፈር ዝርዝር ይጨምሩ።'
    },
    ADD_MISSING_LANGUAGE_AM: {
      en: 'Add Amharic name, branch, and neighborhood details.',
      am: 'የአማርኛ ስም፣ ቅርንጫፍ እና መኖሪያ ሰፈር ዝርዝር ይጨምሩ።'
    },
    ADD_MISSING_LANGUAGE: {
      en: 'Add missing language details for your profile.',
      am: 'ለመገለጫዎ የጎደሉ የቋንቋ ዝርዝሮችን ይጨምሩ።'
    },
    ADD_TRANSFER_INTEREST: {
      en: 'Add at least one transfer interest to improve your matches.',
      am: 'ተዛማጆችን ለማሻሻል ቢያንስ አንድ የዝውውር ፍላጎት ይጨምሩ።'
    },
    ADD_CUSTOM_PHOTO: {
      en: 'Add a custom photo to complete your profile.',
      am: 'መገለጫዎን ለማሟላት ብጁ ፎቶ ይጨምሩ።'
    },
    FULLY_COMPLETE: {
      en: 'Your profile is complete.',
      am: 'መገለጫዎ ሙሉ ነው።'
    }
  };

  // Resolve language.
  const language = user.preferred_language === 'am' ? 'am' : 'en';

  // Return completeness payload.
  return {
    is_marketplace_unlocked: isMarketplaceUnlocked,
    is_fully_complete: isFullyComplete,
    missing_required: missingRequired,
    missing_encouraged: missingEncouraged,
    nudge: {
      show: !isFullyComplete,
      message_code: messageCode,
      message: messages[messageCode][language],
      message_en: messages[messageCode].en,
      message_am: messages[messageCode].am
    }
  };
}
