// Import Zod for request validation.
import { z } from 'zod';

// Maximum allowed distinct regions.
const MAX_REGIONS = 3;

// Maximum allowed zones per region.
const MAX_ZONES_PER_REGION = 3;

// Validate a single interest entry.
const interestEntrySchema = z.object({
  region_id: z.number().int().positive(),
  zone_id: z.number().int().positive().nullable()
});

// Validate bulk save request.
export const saveInterestsSchema = z.object({
  interests: z.array(interestEntrySchema).max(9, {
    message: 'Too many interest entries. Maximum is 3 regions with up to 3 zones each.'
  })
});

// Validate options query.
export const optionsQuerySchema = z.object({
  region_id: z.coerce.number().int().positive().optional()
});

// Validate interest ID param.
export const interestIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

// Export limits for use in service and responses.
export const INTEREST_LIMITS = {
  MAX_REGIONS,
  MAX_ZONES_PER_REGION
};
