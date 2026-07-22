// Import user service.
import * as userService from './user.service.js';

// Import HTTP response helper.
import { ok } from '../../lib/http.js';

// Handle Telegram initData authentication.
export async function authTelegram(req, res, next) {
  try {
    const data = await userService.authTelegram(req.validated.body, { ip: req.ip });
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// Handle internal token issuance.
export async function issueToken(req, res, next) {
  try {
    const data = await userService.issueToken(req.validated.body, { ip: req.ip });
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// Handle profile GET.
export async function getMe(req, res, next) {
  try {
    const data = await userService.getMe(req.user.id);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// Handle profile PUT.
export async function updateProfile(req, res, next) {
  try {
    const data = await userService.updateProfile(req.user.id, req.validated.body, { ip: req.ip });
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// Handle completeness GET.
export async function getCompleteness(req, res, next) {
  try {
    const data = await userService.getCompleteness(req.user.id);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}
