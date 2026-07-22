import * as gradesService from './grades.service.js';
import { ok } from '../../lib/http.js';

export async function listGrades(req, res, next) {
  try {
    const data = await gradesService.listGrades();
    ok(res, data);
  } catch (err) {
    next(err);
  }
}
