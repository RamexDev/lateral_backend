// Telegram profile photo auto-fetch helper.
// Fetches the user's Telegram profile photo and saves it locally.

// Import Node fs and path.
import fs from 'node:fs';
import path from 'node:path';
// Import environment config.
import { env } from '../config/env.js';
// Import logger.
import { logger } from './logger.js';
// Import MySQL pool.
import { pool } from '../db/pool.js';

// Avatar storage directory.
const AVATAR_DIR = env.AVATAR_STORAGE_DIR || './storage/avatars';

// Ensure avatar directory exists.
function ensureAvatarDir() {
  if (!fs.existsSync(AVATAR_DIR)) {
    fs.mkdirSync(AVATAR_DIR, { recursive: true });
  }
}

// Fetch and save a Telegram user's profile photo.
export async function fetchTelegramPhoto(telegramId, userId) {
  const token = env.TELEGRAM_BOT_TOKEN;

  // Skip in dev/test or with dev token.
  if (!token || token.startsWith('dev-') || env.NODE_ENV !== 'production') {
    logger.info({ userId }, 'Telegram photo fetch skipped (non-production).');
    return { fetched: false, reason: 'non_production' };
  }

  try {
    // Step 1: Get user profile photos.
    const photosRes = await fetch(
      'https://api.telegram.org/bot' + token + '/getUserProfilePhotos?user_id=' + telegramId + '&limit=1'
    );
    const photosData = await photosRes.json();

    if (!photosData.ok || !photosData.result.photos || photosData.result.photos.length === 0) {
      logger.info({ userId }, 'No Telegram profile photo found.');
      await pool.query('UPDATE users SET photo_source = ? WHERE id = ?', ['placeholder', userId]);
      return { fetched: false, reason: 'no_photo' };
    }

    // Get the largest available size.
    const photoSizes = photosData.result.photos[0];
    const largestPhoto = photoSizes[photoSizes.length - 1];
    const fileId = largestPhoto.file_id;

    // Step 2: Get file path.
    const fileRes = await fetch(
      'https://api.telegram.org/bot' + token + '/getFile?file_id=' + fileId
    );
    const fileData = await fileRes.json();

    if (!fileData.ok || !fileData.result.file_path) {
      logger.warn({ userId }, 'Failed to get Telegram file path.');
      return { fetched: false, reason: 'file_path_error' };
    }

    // Step 3: Download the file.
    const fileUrl = 'https://api.telegram.org/file/bot' + token + '/' + fileData.result.file_path;
    const downloadRes = await fetch(fileUrl);

    if (!downloadRes.ok) {
      logger.warn({ userId }, 'Failed to download Telegram photo.');
      return { fetched: false, reason: 'download_error' };
    }

    // Step 4: Save to disk.
    ensureAvatarDir();
    const filename = userId + '-telegram.jpg';
    const filepath = path.join(AVATAR_DIR, filename);
    const buffer = Buffer.from(await downloadRes.arrayBuffer());
    fs.writeFileSync(filepath, buffer);

    // Step 5: Update user record.
    const photoUrl = '/avatars/' + filename;
    await pool.query(
      'UPDATE users SET photo_url = ?, photo_source = ? WHERE id = ?',
      [photoUrl, 'telegram', userId]
    );

    logger.info({ userId, filename }, 'Telegram photo saved.');
    return { fetched: true, photo_url: photoUrl };
  } catch (err) {
    logger.error({ err, userId }, 'Telegram photo fetch failed.');
    return { fetched: false, reason: 'error' };
  }
}
