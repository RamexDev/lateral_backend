/**
 * Sequelize seeder: default super admin staff account for first-run bootstrap.
 *
 * Credentials come from env vars (defaults shown) — change them in production via
 * .env before running `npm run seed`. Idempotent on email.
 */
const bcrypt = require('bcryptjs');

async function up(queryInterface, Sequelize) {
  const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@lateral.local';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'ChangeMe123!';
  const fullName = process.env.SUPER_ADMIN_NAME || 'Super Admin';

  const [existing] = await queryInterface.sequelize.query(
    `SELECT id FROM staff WHERE email = :email LIMIT 1`,
    { replacements: { email }, type: Sequelize.QueryTypes.SELECT },
  );
  if (existing) {
    // Already exists — leave it alone so a re-seed doesn't reset the password.
    return;
  }

  const [role] = await queryInterface.sequelize.query(
    `SELECT id FROM roles WHERE name = 'super_admin' LIMIT 1`,
    { type: Sequelize.QueryTypes.SELECT },
  );
  if (!role) {
    throw new Error("super_admin role not found — run migrations first.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await queryInterface.bulkInsert('staff', [
    {
      full_name: fullName,
      email,
      password_hash: passwordHash,
      role_id: role.id,
      preferred_language: 'en',
      is_active: 1,
      last_login_at: null,
    },
  ]);
}

async function down(queryInterface) {
  const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@lateral.local';
  await queryInterface.bulkDelete('staff', { email });
}

module.exports = { up, down };
