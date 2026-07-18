const { z } = require('zod');

const adminBankCreateSchema = z.object({
  name: z.string().min(1).max(150),
  nameAm: z.string().min(1).max(150),
  nickname: z.string().min(1).max(30),
  swiftCode: z.string().max(11).optional().nullable(),
  yearEstablished: z.number().int().min(1800).max(new Date().getFullYear()).optional().nullable(),
});

const adminBankUpdateSchema = z
  .object({
    name: z.string().min(1).max(150).optional(),
    nameAm: z.string().min(1).max(150).optional(),
    nickname: z.string().min(1).max(30).optional(),
    swiftCode: z.string().max(11).optional().nullable(),
    yearEstablished: z.number().int().min(1800).max(new Date().getFullYear()).optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .strict();

const adminLocationCreateSchema = z.object({
  name: z.string().min(1).max(150),
  nameAm: z.string().min(1).max(150),
  levelType: z.enum(['region', 'zone_subcity']),
  parentId: z.number().int().positive().optional().nullable(),
});

const adminLocationUpdateSchema = z
  .object({
    name: z.string().min(1).max(150).optional(),
    nameAm: z.string().min(1).max(150).optional(),
    parentId: z.number().int().positive().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

const adminGradeCreateSchema = z.object({
  gradeNumber: z.number().int().min(1).max(127),
  bandLabel: z.string().min(1).max(40),
  bandLabelAm: z.string().min(1).max(60),
  tierClassification: z.string().min(1).max(60),
  tierClassificationAm: z.string().min(1).max(80),
  typicalRoles: z.string().min(1).max(255),
  typicalRolesAm: z.string().min(1).max(255),
  rankOrder: z.number().int().optional(),
});

const adminGradeUpdateSchema = z
  .object({
    bandLabel: z.string().min(1).max(40).optional(),
    bandLabelAm: z.string().min(1).max(60).optional(),
    tierClassification: z.string().min(1).max(60).optional(),
    tierClassificationAm: z.string().min(1).max(80).optional(),
    typicalRoles: z.string().min(1).max(255).optional(),
    typicalRolesAm: z.string().min(1).max(255).optional(),
    rankOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

const adminStaffCreateSchema = z.object({
  fullName: z.string().min(1).max(150),
  email: z.string().email().max(150),
  password: z.string().min(8).max(255),
  roleName: z.enum(['super_admin', 'platform_admin', 'finance_officer', 'support_officer']),
  preferredLanguage: z.enum(['en', 'am']).optional().default('en'),
});

const adminUserStatusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().max(500).optional().nullable(),
});

const adminBroadcastSchema = z.object({
  segmentFilter: z
    .object({
      scope: z.enum(['all', 'bank', 'region', 'zone']),
      bankId: z.number().int().positive().optional(),
      regionId: z.number().int().positive().optional(),
      zoneId: z.number().int().positive().optional(),
    })
    .strict(),
  message: z.object({
    en: z.string().min(1).max(2000),
    am: z.string().min(1).max(2000),
  }),
});

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(255),
});

const adminRefreshSchema = z.object({
  refreshToken: z.string().min(1).max(255),
});

const adminRevenueQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  bankId: z.coerce.number().int().positive().optional(),
});

const adminUserListQuerySchema = z.object({
  q: z.string().optional(),
  bankId: z.coerce.number().int().positive().optional(),
  regionId: z.coerce.number().int().positive().optional(),
  zoneId: z.coerce.number().int().positive().optional(),
  gradeId: z.coerce.number().int().positive().optional(),
  isActive: z
    .union([z.boolean(), z.string()])
    .transform((v) => (v === true || v === 'true' || v === '1' ? true : false))
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

module.exports = {
  adminBankCreateSchema,
  adminBankUpdateSchema,
  adminLocationCreateSchema,
  adminLocationUpdateSchema,
  adminGradeCreateSchema,
  adminGradeUpdateSchema,
  adminStaffCreateSchema,
  adminUserStatusSchema,
  adminBroadcastSchema,
  adminLoginSchema,
  adminRefreshSchema,
  adminRevenueQuerySchema,
  adminUserListQuerySchema,
};
