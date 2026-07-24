// Import Zod for request validation.
import { z } from 'zod';

// Validate notification list query.
// F.4: adds unread_only filter (no .default() — controller handles undefined).
export const listNotificationsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(50).default(20),
  unread_only: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((value) => value === 'true' || value === '1')
});

// Validate notification ID param.
export const notificationIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

// Validate broadcast request.
export const broadcastSchema = z.object({
  segment_filter: z.object({
    scope: z.enum(['all', 'bank', 'region', 'zone']),
    bank_id: z.number().int().positive().optional(),
    region_id: z.number().int().positive().optional(),
    zone_id: z.number().int().positive().optional()
  }),
  message: z.object({
    en: z.string().trim().min(1).max(500),
    am: z.string().trim().min(1).max(500)
  })
});
