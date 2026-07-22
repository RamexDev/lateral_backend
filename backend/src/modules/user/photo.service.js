// Photo upload and delete service.

// Import Node fs and path.
import fs from 'node:fs';
import path from 'node:path';
// Import environment config.
import { env } from '../../config/env.js';
// Import MySQL pool.
import { pool } from '../../db/pool.js';
// Import API error class.
import { ApiError } from '../../lib/errors.js';
// Import logger.
import { logger } from '../../lib/logger.js';

// Avatar storage directory.
const AVATAR_DIR = env.AVATAR_STORAGE_DIR || './storage/avatars';

// Allowed MIME types.
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

// Max file size: 5 MB.
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

// Ensure avatar directory exists.
function ensureAvatarDir() {
  if (!fs.existsSync(AVATAR_DIR)) {
    fs.mkdirSync(AVATAR_DIR, { recursive: true });
  }
}

// Sanitize filename to prevent path traversal.
function sanitizeFilename(userId, originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
  return userId + '-custom-' + Date.now() + safeExt;
}

// Upload a custom photo.
export async function uploadPhoto(userId, file) {
  // Validate file exists.
  if (!file || !file.buffer) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'No file provided.');
  }

  // Validate MIME type.
  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'Invalid file type. Allowed: JPEG, PNG, WEBP.');
  }

  // Validate file size.
  if (file.size > MAX_SIZE_BYTES) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'File too large. Maximum 5 MB.');
  }

  // Ensure directory exists.
  ensureAvatarDir();

  // Generate safe filename.
  const filename = sanitizeFilename(userId, file.originalname);
  const filepath = path.join(AVATAR_DIR, filename);

  // Write file to disk.
  fs.writeFileSync(filepath, file.buffer);

  // Delete old custom photo if exists.
  const [rows] = await pool.query('SELECT photo_url, photo_source FROM users WHERE id = ?', [userId]);
  if (rows[0] && rows[0].photo_source === 'custom' && rows[0].photo_url) {
    const oldPath = path.join(AVATAR_DIR, path.basename(rows[0].photo_url));
    try {
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    } catch (err) {
      logger.warn({ err, oldPath }, 'Failed to delete old custom photo.');
    }
  }

  // Update user record.
  const photoUrl = '/avatars/' + filename;
  await pool.query(
    'UPDATE users SET photo_url = ?, photo_source = ? WHERE id = ?',
    [photoUrl, 'custom', userId]
  );

  return { photo_url: photoUrl, photo_source: 'custom' };
}

// Delete custom photo and revert to Telegram or placeholder.
export async function deletePhoto(userId) {
  // Get current photo info.
  const [rows] = await pool.query('SELECT photo_url, photo_source FROM users WHERE id = ?', [userId]);
  const user = rows[0];

  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found.');
  }

  // Delete the custom file if it exists.
  if (user.photo_source === 'custom' && user.photo_url) {
    const filepath = path.join(AVATAR_DIR, path.basename(user.photo_url));
    try {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    } catch (err) {
      logger.warn({ err, filepath }, 'Failed to delete custom photo file.');
    }
  }

  // Check if a Telegram photo exists.
  const telegramFilename = userId + '-telegram.jpg';
  const telegramPath = path.join(AVATAR_DIR, telegramFilename);

  if (fs.existsSync(telegramPath)) {
    // Revert to Telegram photo.
    const photoUrl = '/avatars/' + telegramFilename;
    await pool.query(
      'UPDATE users SET photo_url = ?, photo_source = ? WHERE id = ?',
      [photoUrl, 'telegram', userId]
    );
    return { photo_url: photoUrl, photo_source: 'telegram' };
  }

  // Revert to placeholder.
  await pool.query(
    'UPDATE users SET photo_url = NULL, photo_source = ? WHERE id = ?',
    ['placeholder', userId]
  );
  return { photo_url: null, photo_source: 'placeholder' };
}
