/**
 * Seed: a default super admin staff account for first-run bootstrap.
 *
 * Credentials come from env vars (defaults shown) — change them in production via
 * .env before running `npm run seed`. The seeder is idempotent on email.
 */
const staffRepo = require('../../repositories/staffRepository');
const passwordUtil = require('../../utils/password');
const logger = require('../../utils/logger');

async function seedSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@lateral.local';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'ChangeMe123!';
  const fullName = process.env.SUPER_ADMIN_NAME || 'Super Admin';

  const existing = await staffRepo.findByEmail(email);
  if (existing) {
    logger.info(`Super admin already exists: ${email}`);
    return { id: existing.id, skipped: true };
  }

  const role = await staffRepo.findRoleByName('super_admin');
  if (!role) throw new Error('super_admin role not found — run migrations first.');

  const passwordHash = await passwordUtil.hash(password);
  const id = await staffRepo.create({
    full_name: fullName,
    email,
    password_hash: passwordHash,
    role_id: role.id,
    preferred_language: 'en',
    is_active: true,
  });

  logger.info(`Seeded super admin: ${email} (id=${id})`);
  return { id, skipped: false };
}

module.exports = { seedSuperAdmin };
