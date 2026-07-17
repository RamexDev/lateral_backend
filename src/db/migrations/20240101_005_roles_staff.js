/**
 * Migration: roles + staff
 * RBAC tables for admin access. See backend.md §3.2 (roles, staff) and §11 (RBAC matrix).
 *
 * Roles: super_admin | platform_admin | finance_officer | support_officer
 */
exports.up = function (knex) {
  return knex.schema
    .createTable('roles', (table) => {
      table.increments('id').unsigned().primary();
      table.string('name', 50).notNullable().unique();
    })
    .then(() =>
      knex('roles').insert([
        { name: 'super_admin' },
        { name: 'platform_admin' },
        { name: 'finance_officer' },
        { name: 'support_officer' },
      ]),
    )
    .then(() =>
      knex.schema.createTable('staff', (table) => {
        table.bigIncrements('id').unsigned().primary();
        table.string('full_name', 150).notNullable();
        table.string('email', 150).notNullable().unique();
        table.string('password_hash', 255).notNullable();
        table.integer('role_id').unsigned().notNullable();
        table.enu('preferred_language', ['en', 'am']).notNullable().defaultTo('en');
        table.boolean('is_active').notNullable().defaultTo(true);
        table.timestamp('last_login_at').nullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

        table.foreign('role_id').references('roles.id').onDelete('RESTRICT');
      }),
    );
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('staff').then(() => knex.schema.dropTableIfExists('roles'));
};
