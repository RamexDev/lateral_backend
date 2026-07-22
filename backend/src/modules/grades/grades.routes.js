import { Router } from 'express';
import * as gradesController from './grades.controller.js';

const router = Router();

router.get('/', gradesController.listGrades);

export default router;
