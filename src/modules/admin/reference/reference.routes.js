// Import Express router.
import { Router } from 'express';

// Import staff authentication middleware.
import { authenticateStaff } from '../../../middleware/auth.js';

// Import validation middleware.
import { validate } from '../../../middleware/validate.js';

// Import reference controller.
import * as referenceController from './reference.controller.js';

// Import reference schemas.
import {
  idParamSchema,
  listQuerySchema,
  createBankSchema,
  updateBankSchema,
  createRegionSchema,
  updateRegionSchema,
  createZoneSchema,
  updateZoneSchema,
  createGradeSchema,
  updateGradeSchema
} from './reference.schema.js';

// Create admin reference router.
const router = Router();

// Require staff authentication for all reference routes.
router.use(authenticateStaff);

// Banks.
router.get('/banks', validate(listQuerySchema, 'query'), referenceController.listBanks);
router.post('/banks', validate(createBankSchema), referenceController.createBank);
router.patch('/banks/:id', validate(idParamSchema, 'params'), validate(updateBankSchema), referenceController.updateBank);

// Regions.
router.get('/regions', validate(listQuerySchema, 'query'), referenceController.listRegions);
router.post('/regions', validate(createRegionSchema), referenceController.createRegion);
router.patch('/regions/:id', validate(idParamSchema, 'params'), validate(updateRegionSchema), referenceController.updateRegion);

// Zones.
router.get('/zones', validate(listQuerySchema, 'query'), referenceController.listZones);
router.post('/zones', validate(createZoneSchema), referenceController.createZone);
router.patch('/zones/:id', validate(idParamSchema, 'params'), validate(updateZoneSchema), referenceController.updateZone);

// Grades.
router.get('/grades', validate(listQuerySchema, 'query'), referenceController.listGrades);
router.post('/grades', validate(createGradeSchema), referenceController.createGrade);
router.patch('/grades/:id', validate(idParamSchema, 'params'), validate(updateGradeSchema), referenceController.updateGrade);

// Export admin reference router.
export default router;
