// Import Zod for request validation.
import { z } from 'zod';

// Validate user list query.
export const userListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(100).default(25),
  q: z.string().trim().optional(),
  bank_id: z.coerce.number().int().positive().optional(),
  region_id: z.coerce.number().int().positive().optional(),
  zone_id: z.coerce.number().int().positive().optional(),
  grade_id: z.coerce.number().int().positive().optional(),
  is_active: z.enum(['true', 'false', '1', '0']).optional().transform((v) => v === undefined ? undefined : v === 'true' || v === '1'),
  profile_complete: z.enum(['true', 'false', '1', '0']).optional().transform((v) => v === undefined ? undefined : v === 'true' || v === '1')
});

// Validate user ID param.
export const userIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

// Validate user status update.
export const userStatusSchema = z.object({
  is_active: z.boolean(),
  reason: z.string().trim().max(500).optional()
});

// Validate staff list query.
export const staffListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(100).default(50)
});

// Validate staff creation.
export const createStaffSchema = z.object({
  full_name: z.string().trim().min(1).max(150),
  email: z.string().trim().email().max(150),
  password: z.string().min(8).max(200),
  role: z.enum(['super_admin', 'admin']),
  preferred_language: z.enum(['en', 'am']).default('en')
});

// Validate staff update.
export const updateStaffSchema = z.object({
  full_name: z.string().trim().min(1).max(150).optional(),
  role: z.enum(['super_admin', 'admin']).optional(),
  preferred_language: z.enum(['en', 'am']).optional(),
  is_active: z.boolean().optional()
}).refine((data) => Object.values(data).some((v) => v !== undefined), {
  message: 'At least one field is required'
});

// Validate staff ID param.
export const staffIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

// Validate report date range query.
export const reportQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional()
});
