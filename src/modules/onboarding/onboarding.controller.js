// Import onboarding service.
import * as onboardingService from './onboarding.service.js';

// Import HTTP response helper.
import { ok } from '../../lib/http.js';

// Handle onboarding start.
export async function start(req, res, next) {
  try {
    const data = await onboardingService.start(req.validated.body);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// Handle language selection.
export async function selectLanguage(req, res, next) {
  try {
    const data = await onboardingService.selectLanguage(req.validated.body);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// Handle contact share.
export async function shareContact(req, res, next) {
  try {
    const data = await onboardingService.shareContact(req.validated.body);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// Handle bank selection.
export async function selectBank(req, res, next) {
  try {
    const data = await onboardingService.selectBank(req.validated.body);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// Handle region selection.
export async function selectRegion(req, res, next) {
  try {
    const data = await onboardingService.selectRegion(req.validated.body);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// Handle zone selection.
export async function selectZone(req, res, next) {
  try {
    const data = await onboardingService.selectZone(req.validated.body);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// Handle OTP request stub.
export async function requestOtp(req, res, next) {
  try {
    const data = await onboardingService.requestOtp(req.validated.body);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// Handle OTP verify stub.
export async function verifyOtp(req, res, next) {
  try {
    const data = await onboardingService.verifyOtp(req.validated.body);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}
