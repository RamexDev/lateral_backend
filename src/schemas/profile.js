const { z } = require('zod');

const updateMeSchema = z
  .object({
    branchName: z.string().min(3).max(150).optional(),
    neighborhood: z.string().max(150).nullable().optional(),
    regionId: z.number().int().positive().optional(),
    zoneId: z.number().int().positive().optional(),
    gradeId: z.number().int().positive().optional(),
    preferredLanguage: z.enum(['en', 'am']).optional(),
    bankId: z.number().int().positive().optional(),
  })
  .strict();

module.exports = { updateMeSchema };
