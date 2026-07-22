// Import reference service.
import * as referenceService from './reference.service.js';

// Import HTTP response helper.
import { ok } from '../../../lib/http.js';

// List banks.
export async function listBanks(req, res, next) {
  try {
    const data = await referenceService.listBanks(req.validated.query);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// Create bank.
export async function createBank(req, res, next) {
  try {
    const data = await referenceService.createBank(req.validated.body, req.staff);
    ok(res, data, undefined, 201);
  } catch (err) {
    next(err);
  }
}

// Update bank.
export async function updateBank(req, res, next) {
  try {
    const data = await referenceService.updateBank(req.validated.params.id, req.validated.body, req.staff);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// List regions.
export async function listRegions(req, res, next) {
  try {
    const data = await referenceService.listRegions(req.validated.query);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// Create region.
export async function createRegion(req, res, next) {
  try {
    const data = await referenceService.createRegion(req.validated.body, req.staff);
    ok(res, data, undefined, 201);
  } catch (err) {
    next(err);
  }
}

// Update region.
export async function updateRegion(req, res, next) {
  try {
    const data = await referenceService.updateRegion(req.validated.params.id, req.validated.body, req.staff);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// List zones.
export async function listZones(req, res, next) {
  try {
    const data = await referenceService.listZones(req.validated.query);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// Create zone.
export async function createZone(req, res, next) {
  try {
    const data = await referenceService.createZone(req.validated.body, req.staff);
    ok(res, data, undefined, 201);
  } catch (err) {
    next(err);
  }
}

// Update zone.
export async function updateZone(req, res, next) {
  try {
    const data = await referenceService.updateZone(req.validated.params.id, req.validated.body, req.staff);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// List grades.
export async function listGrades(req, res, next) {
  try {
    const data = await referenceService.listGrades(req.validated.query);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// Create grade.
export async function createGrade(req, res, next) {
  try {
    const data = await referenceService.createGrade(req.validated.body, req.staff);
    ok(res, data, undefined, 201);
  } catch (err) {
    next(err);
  }
}

// Update grade.
export async function updateGrade(req, res, next) {
  try {
    const data = await referenceService.updateGrade(req.validated.params.id, req.validated.body, req.staff);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}
