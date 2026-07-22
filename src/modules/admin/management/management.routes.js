// Import Express router.
import { Router } from 'express';
// Import staff authentication middleware.
import { authenticateStaff, requireRole } from '../../../middleware/auth.js';
// Import validation middleware.
import { validate } from '../../../middleware/validate.js';
// Import management controller.
import * as managementController from './management.controller.js';
// Import management schemas.
import {
  userListSchema, userIdParamSchema, userStatusSchema,
  staffListSchema, createStaffSchema, updateStaffSchema, staffIdParamSchema,
  reportQuerySchema
} from './management.schema.js';

// Create management router.
const router = Router();

// All management routes require staff authentication.
router.use(authenticateStaff);

// Dashboard.
router.get('/dashboard/summary', managementController.getDashboardSummary);

// User monitoring.
router.get('/users', validate(userListSchema, 'query'), managementController.listUsers);
router.get('/users/:id', validate(userIdParamSchema, 'params'), managementController.getUserDetail);
router.patch('/users/:id/status', validate(userIdParamSchema, 'params'), validate(userStatusSchema), managementController.updateUserStatus);

// Staff management (super_admin only).
router.get('/staff', requireRole('super_admin'), validate(staffListSchema, 'query'), managementController.listStaff);
router.post('/staff', requireRole('super_admin'), validate(createStaffSchema), managementController.createStaff);
router.patch('/staff/:id', requireRole('super_admin'), validate(staffIdParamSchema, 'params'), validate(updateStaffSchema), managementController.updateStaff);

// Reports.
router.get('/reports/revenue', validate(reportQuerySchema, 'query'), managementController.getRevenueReport);
router.get('/reports/users', validate(reportQuerySchema, 'query'), managementController.getUserReport);
router.get('/reports/interests', validate(reportQuerySchema, 'query'), managementController.getInterestReport);

// System health.
router.get('/system/health', managementController.getSystemHealth);

// Export management router.
export default router;
