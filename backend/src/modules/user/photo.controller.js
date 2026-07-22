// Import photo service.
import * as photoService from './photo.service.js';
// Import HTTP response helper.
import { ok } from '../../lib/http.js';

// Handle POST /api/v1/me/photo
export async function uploadPhoto(req, res, next) {
  try {
    const data = await photoService.uploadPhoto(req.user.id, req.file);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// Handle DELETE /api/v1/me/photo
export async function deletePhoto(req, res, next) {
  try {
    const data = await photoService.deletePhoto(req.user.id);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}
