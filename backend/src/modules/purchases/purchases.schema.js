// Import Zod for request validation.
import { z } from 'zod';

// Validate purchase creation request body.
export const createPurchaseSchema = z.object({
  target_user_id: z.coerce.number().int().positive()
});

// Validate purchase list query parameters.
// F.3: adds status filter (no .default() — controller handles undefined).
export const listPurchasesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(50).default(20),
  status: z.enum(['completed', 'pending', 'all']).optional()
});
