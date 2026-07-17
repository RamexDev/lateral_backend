/**
 * Migration: locations
 * Shared administrative geography (region + zone_subcity).
 * See backend.md §3.2 (locations table) and §3.1 (design note).
 *
 * The locations tree is bank-agnostic: every bank shares the same geography.
 * A user's exact branch identity is captured as free text on the users row.
 */
exports.up = function (knex) {
  return knex.schema.createTable('locations', (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.bigInteger('parent_id').unsigned().nullable();
    table.string('name', 150).notNullable();
    table.string('name_am', 150).notNullable();
    table.enu('level_type', ['region', 'zone_subcity']).notNullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.foreign('parent_id').references('locations.id').onDelete('RESTRICT');
    table.index('parent_id', 'idx_loc_parent');
    table.index('level_type', 'idx_loc_level');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('locations');
};
