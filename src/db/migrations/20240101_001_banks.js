/**
 * Migration: banks
 * Reference data — bank directory shared across the platform.
 * See backend.md §3.2 (banks table).
 */
exports.up = function (knex) {
  return knex.schema.createTable('banks', (table) => {
    table.increments('id').unsigned().primary();
    table.string('name', 150).notNullable();
    table.string('name_am', 150).notNullable();
    table.string('nickname', 30).notNullable().unique();
    table.string('swift_code', 11).nullable();
    table.smallint('year_established').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('banks');
};
