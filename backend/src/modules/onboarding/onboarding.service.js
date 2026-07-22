// Import MySQL pool.
import { pool } from '../../db/pool.js';

// Import Redis client.
import { redis } from '../../lib/redis.js';

// Import environment variables.
import { env } from '../../config/env.js';

// Import API error class.
import { ApiError } from '../../lib/errors.js';

// Import Telegram helper.
import { sendTelegramMessage } from '../../lib/telegram.js';

// Bot onboarding session TTL: 24 hours.
const SESSION_TTL_SECONDS = 24 * 60 * 60;

// Build the Redis session key for a Telegram user.
function sessionKey(telegramId) {
  return 'bot:session:' + telegramId;
}

// Build the Mini App profile deep link.
function miniAppProfileUrl() {
  const base = env.MINI_APP_URL;
  return base + (base.includes('?') ? '&' : '?') + 'startapp=profile';
}

// Save bot onboarding session.
async function saveSession(telegramId, session) {
  await redis.set(sessionKey(telegramId), JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
}

// Read bot onboarding session.
async function getSession(telegramId) {
  const raw = await redis.get(sessionKey(telegramId));

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Read session or throw a validation error.
async function getSessionOrThrow(telegramId) {
  const session = await getSession(telegramId);

  if (!session) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'Onboarding session missing. Please restart onboarding.');
  }

  return session;
}

// Delete bot onboarding session.
async function deleteSession(telegramId) {
  await redis.del(sessionKey(telegramId));
}

// Find an existing user by Telegram ID with reference names.
async function findUserByTelegramId(telegramId) {
  const [rows] = await pool.query(
    'SELECT ' +
    'u.id, ' +
    'u.is_active, ' +
    'u.profile_completed_at, ' +
    'b.name_en AS bank_name, ' +
    'b.name_am AS bank_name_am, ' +
    'r.name_en AS region_name, ' +
    'r.name_am AS region_name_am, ' +
    'z.name_en AS zone_name, ' +
    'z.name_am AS zone_name_am ' +
    'FROM users u ' +
    'JOIN banks b ON b.id = u.bank_id ' +
    'JOIN regions r ON r.id = u.region_id ' +
    'JOIN zones z ON z.id = u.zone_id ' +
    'WHERE u.telegram_id = ?',
    [telegramId]
  );

  return rows[0] || null;
}

// Serialize an existing user for the start response.
function existingUserPayload(user) {
  return {
    step: 'already_registered',
    user_id: user.id,
    profile_complete: Boolean(user.profile_completed_at),
    bank_name: user.bank_name,
    bank_name_am: user.bank_name_am,
    region: user.region_name,
    region_am: user.region_name_am,
    zone: user.zone_name,
    zone_am: user.zone_name_am,
    mini_app_url: miniAppProfileUrl()
  };
}

// Ensure phone number is not already used by another Telegram account in the same bank.
async function assertPhoneBankAvailable(telegramId, phoneNumber, bankId) {
  const [rows] = await pool.query(
    'SELECT id FROM users WHERE phone_number = ? AND bank_id = ? AND telegram_id <> ?',
    [phoneNumber, bankId, telegramId]
  );

  if (rows[0]) {
    throw new ApiError(409, 'DUPLICATE_PHONE_BANK', 'Phone number is already registered under this bank.');
  }
}

// Create an incomplete user after bot onboarding finishes.
async function createIncompleteUser(payload) {
  // Use a dedicated connection so we can relax CHECK enforcement for incomplete users.
  const connection = await pool.getConnection();

  try {
    // Best effort: disable CHECK enforcement for this session.
    // This supports databases where the old bilingual CHECK constraints still exist.
    try {
      await connection.query('SET SESSION check_constraint_checks=0');
    } catch {
      // Ignore if the database does not support this variable.
    }

    // Start transaction.
    await connection.beginTransaction();

    // If the Telegram user already exists, return that user.
    const [existingRows] = await connection.query(
      'SELECT id FROM users WHERE telegram_id = ?',
      [payload.telegram_id]
    );

    if (existingRows[0]) {
      await connection.commit();
      return existingRows[0].id;
    }

    // Enforce duplicate phone+bank rule.
    const [duplicateRows] = await connection.query(
      'SELECT id FROM users WHERE phone_number = ? AND bank_id = ? AND telegram_id <> ?',
      [payload.phone_number, payload.bank_id, payload.telegram_id]
    );

    if (duplicateRows[0]) {
      await connection.rollback();
      throw new ApiError(409, 'DUPLICATE_PHONE_BANK', 'Phone number is already registered under this bank.');
    }

    // Insert incomplete user.
    const [result] = await connection.query(
      'INSERT INTO users (' +
      'telegram_id, telegram_username, phone_number, bank_id, region_id, zone_id, ' +
      'preferred_language, photo_source, is_active, last_activity_at' +
      ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW())',
      [
        payload.telegram_id,
        payload.telegram_username,
        payload.phone_number,
        payload.bank_id,
        payload.region_id,
        payload.zone_id,
        payload.language,
        'placeholder'
      ]
    );

    // Commit transaction.
    await connection.commit();

    // Return new user ID.
    return result.insertId;
  } catch (err) {
    // Roll back on failure.
    try {
      await connection.rollback();
    } catch {
      // Ignore rollback failure.
    }

    // Map duplicate-entry database errors to API conflict errors.
    if (err instanceof ApiError) {
      throw err;
    }

    if (err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'DUPLICATE_PHONE_BANK', 'Duplicate Telegram ID or phone/bank combination.');
    }

    throw err;
  } finally {
    // Always release the connection.
    connection.release();
  }
}

// Start or resume onboarding.
export async function start({ telegram_id, telegram_username }) {
  // If the Telegram user already has an account, return existing state.
  const existing = await findUserByTelegramId(telegram_id);

  if (existing) {
    // Reject disabled accounts.
    if (!existing.is_active) {
      throw new ApiError(403, 'ACCOUNT_DISABLED', 'Account is disabled.');
    }

    return existingUserPayload(existing);
  }

  // Create a fresh onboarding session.
  const session = {
    step: 'select_language',
    telegram_id,
    telegram_username: telegram_username || null
  };

  await saveSession(telegram_id, session);

  // Return language selection step.
  return {
    step: 'select_language',
    languages: [
      { code: 'en', label: 'English' },
      { code: 'am', label: 'አማርኛ' }
    ]
  };
}

// Select language.
export async function selectLanguage({ telegram_id, language }) {
  // If already registered, return existing state.
  const existing = await findUserByTelegramId(telegram_id);
  if (existing) {
    if (!existing.is_active) {
      throw new ApiError(403, 'ACCOUNT_DISABLED', 'Account is disabled.');
    }
    return existingUserPayload(existing);
  }

  // Load or create session.
  const session = (await getSession(telegram_id)) || { telegram_id, step: 'select_language' };

  // Store selected language.
  session.language = language;
  session.step = 'share_contact';

  await saveSession(telegram_id, session);

  // Ask for Telegram native contact share.
  return {
    step: 'share_contact',
    requires_native_contact_share: true
  };
}

// Share contact.
export async function shareContact({ telegram_id, phone_number, contact_is_self }) {
  // Telegram contact share must belong to the same Telegram user.
  if (!contact_is_self) {
    throw new ApiError(422, 'CONTACT_NOT_SELF', 'Contact share must belong to the Telegram user.');
  }

  // If already registered, return existing state.
  const existing = await findUserByTelegramId(telegram_id);
  if (existing) {
    if (!existing.is_active) {
      throw new ApiError(403, 'ACCOUNT_DISABLED', 'Account is disabled.');
    }
    return existingUserPayload(existing);
  }

  // Load session.
  const session = await getSessionOrThrow(telegram_id);

  // Store phone number.
  session.phone_number = phone_number.trim();
  session.step = 'select_bank';

  await saveSession(telegram_id, session);

  // Fetch first page of active banks.
  const [banks] = await pool.query(
    'SELECT id, name_en, name_am, alias_en FROM banks WHERE is_active = TRUE ORDER BY alias_en ASC LIMIT 10 OFFSET 0'
  );

  // Count active banks.
  const [countRows] = await pool.query('SELECT COUNT(*) AS total FROM banks WHERE is_active = TRUE');

  // Return bank selection step.
  return {
    step: 'select_bank',
    banks: banks.map((bank) => ({
      id: bank.id,
      name: bank.name_en,
      name_am: bank.name_am,
      nickname: bank.alias_en
    })),
    page: 1,
    page_size: 10,
    total_banks: Number(countRows[0].total)
  };
}

// Select bank.
export async function selectBank({ telegram_id, bank_id }) {
  // Load session.
  const session = await getSessionOrThrow(telegram_id);

  // Phone number must already be collected.
  if (!session.phone_number) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'Phone number is required before selecting a bank.');
  }

  // Validate bank exists and is active.
  const [rows] = await pool.query('SELECT id, is_active FROM banks WHERE id = ?', [bank_id]);

  if (!rows[0]) {
    throw new ApiError(404, 'NOT_FOUND', 'Bank not found.');
  }

  if (!rows[0].is_active) {
    throw new ApiError(422, 'BANK_INACTIVE', 'Selected bank is inactive.');
  }

  // Enforce duplicate phone+bank rule as soon as bank is known.
  await assertPhoneBankAvailable(telegram_id, session.phone_number, bank_id);

  // Store bank selection.
  session.bank_id = bank_id;
  session.step = 'select_region';

  await saveSession(telegram_id, session);

  // Fetch active regions.
  const [regions] = await pool.query(
    'SELECT id, name_en, name_am FROM regions WHERE is_active = TRUE ORDER BY id ASC'
  );

  // Return region selection step.
  return {
    step: 'select_region',
    regions: regions.map((region) => ({
      id: region.id,
      name: region.name_en,
      name_am: region.name_am
    }))
  };
}

// Select region.
export async function selectRegion({ telegram_id, region_id }) {
  // Load session.
  const session = await getSessionOrThrow(telegram_id);

  // Validate region exists and is active.
  const [rows] = await pool.query('SELECT id, is_active FROM regions WHERE id = ?', [region_id]);

  if (!rows[0]) {
    throw new ApiError(404, 'NOT_FOUND', 'Region not found.');
  }

  if (!rows[0].is_active) {
    throw new ApiError(422, 'REGION_INACTIVE', 'Selected region is inactive.');
  }

  // Store region selection.
  session.region_id = region_id;
  session.step = 'select_zone';

  await saveSession(telegram_id, session);

  // Fetch active zones under the selected region.
  const [zones] = await pool.query(
    'SELECT id, name_en, name_am FROM zones WHERE region_id = ? AND is_active = TRUE ORDER BY id ASC',
    [region_id]
  );

  // Return zone selection step.
  return {
    step: 'select_zone',
    region: {
      id: rows[0].id,
      name: rows[0].name_en,
      name_am: rows[0].name_am
    },
    zones: zones.map((zone) => ({
      id: zone.id,
      name: zone.name_en,
      name_am: zone.name_am
    }))
  };
}

// Select zone and create incomplete user.
export async function selectZone({ telegram_id, zone_id }) {
  // Load session.
  const session = await getSessionOrThrow(telegram_id);

  // Ensure required onboarding data exists.
  if (!session.language || !session.phone_number || !session.bank_id || !session.region_id) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'Onboarding session is incomplete.');
  }

  // If already registered, return existing state.
  const existing = await findUserByTelegramId(telegram_id);
  if (existing) {
    if (!existing.is_active) {
      throw new ApiError(403, 'ACCOUNT_DISABLED', 'Account is disabled.');
    }
    return existingUserPayload(existing);
  }

  // Validate zone exists and is active.
  const [rows] = await pool.query(
    'SELECT id, region_id, is_active FROM zones WHERE id = ?',
    [zone_id]
  );

  if (!rows[0]) {
    throw new ApiError(404, 'NOT_FOUND', 'Zone not found.');
  }

  if (!rows[0].is_active) {
    throw new ApiError(422, 'ZONE_INACTIVE', 'Selected zone is inactive.');
  }

  // Ensure zone belongs to selected region.
  if (rows[0].region_id !== session.region_id) {
    throw new ApiError(422, 'ZONE_REGION_MISMATCH', 'Selected zone does not belong to the selected region.');
  }

  // Re-validate duplicate phone+bank at final creation step.
  await assertPhoneBankAvailable(telegram_id, session.phone_number, session.bank_id);

  // Create incomplete user.
  const userId = await createIncompleteUser({
    telegram_id,
    telegram_username: session.telegram_username || null,
    phone_number: session.phone_number,
    bank_id: session.bank_id,
    region_id: session.region_id,
    zone_id,
    language: session.language
  });

  // Clear onboarding session.
  await deleteSession(telegram_id);

  // Send a non-blocking Mini App reminder.
  sendTelegramMessage(
    telegram_id,
    'Registration started. Please open the Mini App to complete your profile.'
  ).catch(() => {
    // Ignore Telegram send failures during onboarding response.
  });

  // Return basic profile creation step.
  return {
    step: 'profile_created_basic',
    user_id: userId,
    profile_complete: false,
    mini_app_url: miniAppProfileUrl()
  };
}

// OTP fallback stub: request OTP.
export async function requestOtp({ telegram_id, phone_number }) {
  // Load or create session.
  const session = (await getSession(telegram_id)) || { telegram_id, step: 'select_language' };

  // Store phone number and move to OTP verification step.
  session.phone_number = phone_number.trim();
  session.step = 'otp_verify';

  await saveSession(telegram_id, session);

  // Return stub OTP step.
  return {
    step: 'otp_verify',
    otp_expires_in_seconds: 300
  };
}

// OTP fallback stub: verify OTP.
export async function verifyOtp({ telegram_id, code }) {
  // OTP is only stubbed outside production.
  if (env.NODE_ENV === 'production') {
    throw new ApiError(501, 'NOT_IMPLEMENTED', 'OTP verification is not configured for production.');
  }

  // Accept any six-digit code in non-production.
  if (!code || code.length !== 6) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'Invalid OTP code.');
  }

  // Load session.
  const session = await getSessionOrThrow(telegram_id);

  // Phone number must exist.
  if (!session.phone_number) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'Phone number is missing from onboarding session.');
  }

  // Move to bank selection.
  session.step = 'select_bank';

  await saveSession(telegram_id, session);

  // Return bank selection step.
  return {
    step: 'select_bank'
  };
}
