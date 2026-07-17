/**
 * Migration: users
 * Core domain — registered bank employees seeking lateral transfers.
 * See backend.md §3.2 (users table).
 *
 * Notes:
 * - current_location_id references locations.level_type='zone_subcity'
 * - branch_name + neighborhood are free text, only revealed on paid purchase (SEC-010)
 * - uq_phone_bank enforces FR-AUTH-003 (no duplicate phone under same bank across Telegram accounts)
 */
exports.up = function (knex) {
  return knex.schema.createTable('users', (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.bigInteger('telegram_id').unsigned().notNullable().unique();
    table.string('telegram_username', 64).nullable();
    table.string('phone_number', 20).notNullable();
    table.timestamp('phone_verified_at').nullable();
    table.integer('bank_id').unsigned().notNullable();
    table.bigInteger('current_location_id').unsigned().notNullable();
    table.string('branch_name', 150).notNullable();
    table.string('neighborhood', 150).nullable();
    table.integer('grade_id').unsigned().notNullable();
    table.enu('preferred_language', ['en', 'am']).notNullable().defaultTo('en');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('last_digest_at').nullable();
    table.timestamp('last_activity_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.foreign('bank_id').references('banks.id').onDelete('RESTRICT');
    table.foreign('current_location_id').references('locations.id').onDelete('RESTRICT');
    table.foreign('grade_id').references('grades.id').onDelete('RESTRICT');
    table.unique(['phone_number', 'bank_id'], 'uq_phone_bank');
    table.index(['bank_id', 'current_location_id'], 'idx_user_bank_location');
    table.index(['is_active', 'last_activity_at'], 'idx_user_activity');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('users');
};
