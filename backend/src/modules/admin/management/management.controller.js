// Import management service.
import * as managementService from './management.service.js';
// Import HTTP response helper.
import { ok } from '../../../lib/http.js';

// Dashboard.
export async function getDashboardSummary(req, res, next) {
  try {
    const data = await managementService.getDashboardSummary();
    ok(res, data);
  } catch (err) { next(err); }
}

// User monitoring.
export async function listUsers(req, res, next) {
  try {
    const query = req.validated ? req.validated.query : req.query;
    const data = await managementService.listUsers(query);
    ok(res, data);
  } catch (err) { next(err); }
}

export async function getUserDetail(req, res, next) {
  try {
    const params = req.validated ? req.validated.params : req.params;
    const data = await managementService.getUserDetail(Number(params.id));
    ok(res, data);
  } catch (err) { next(err); }
}

export async function updateUserStatus(req, res, next) {
  try {
    const params = req.validated ? req.validated.params : req.params;
    const body = req.validated ? req.validated.body : req.body;
    const data = await managementService.updateUserStatus(Number(params.id), body, req.staff);
    ok(res, data);
  } catch (err) { next(err); }
}

// Staff management.
export async function listStaff(req, res, next) {
  try {
    const query = req.validated ? req.validated.query : req.query;
    const data = await managementService.listStaff(query);
    ok(res, data);
  } catch (err) { next(err); }
}

export async function createStaff(req, res, next) {
  try {
    const body = req.validated ? req.validated.body : req.body;
    const data = await managementService.createStaff(body, req.staff);
    ok(res, data, undefined, 201);
  } catch (err) { next(err); }
}

export async function updateStaff(req, res, next) {
  try {
    const params = req.validated ? req.validated.params : req.params;
    const body = req.validated ? req.validated.body : req.body;
    const data = await managementService.updateStaff(Number(params.id), body, req.staff);
    ok(res, data);
  } catch (err) { next(err); }
}

// Reports.
export async function getRevenueReport(req, res, next) {
  try {
    const query = req.validated ? req.validated.query : req.query;
    const data = await managementService.getRevenueReport(query);
    ok(res, data);
  } catch (err) { next(err); }
}

export async function getUserReport(req, res, next) {
  try {
    const query = req.validated ? req.validated.query : req.query;
    const data = await managementService.getUserReport(query);
    ok(res, data);
  } catch (err) { next(err); }
}

export async function getInterestReport(req, res, next) {
  try {
    const query = req.validated ? req.validated.query : req.query;
    const data = await managementService.getInterestReport(query);
    ok(res, data);
  } catch (err) { next(err); }
}

// System health.
export async function getSystemHealth(req, res, next) {
  try {
    const data = await managementService.getSystemHealth();
    ok(res, data);
  } catch (err) { next(err); }
}
