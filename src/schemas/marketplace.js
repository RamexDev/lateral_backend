const { z } = require('zod');

const feedQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
  fresh: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true' || v === '1')
    .default(false),
});

const purchaseSchema = z.object({
  targetUserId: z.number().int().positive(),
});

module.exports = { feedQuerySchema, purchaseSchema };
