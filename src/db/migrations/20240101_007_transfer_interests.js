/**
 * Migration: transfer_interests
 * A user's set of desired transfer locations (zone_subcity today; region supported by schema).
 * See backend.md §3.2 (transfer_interests) and §6.4 (interest API).
 *
 * uq_user_location guarantees idempotent re-confirm: re-selecting an already-saved zone is a no-op.
 */
exports.up = function (knex) {
  return knex.schema.createTable('transfer_interests', (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.bigInteger('user_id').unsigned().notNullable();
    table.bigInteger('location_id').unsigned().notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.foreign('user_id').references('users.id').onDelete('CASCADE');
    table.foreign('location_id').references('locations.id').onDelete('RESTRICT');
    table.unique(['user_id', 'location_id'], 'uq_user_location');
    table.index('location_id', 'idx_ti_location');
    table.index('user_id', 'idx_ti_user');
    table.index('created_at', 'idx_ti_created');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('transfer_interests');
};
