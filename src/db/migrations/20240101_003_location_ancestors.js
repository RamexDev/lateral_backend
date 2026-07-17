/**
 * Migration: location_ancestors (closure table).
 * Precomputed transitive closure over `locations` for fast hierarchy matching.
 * See backend.md §3.2 (location_ancestors) and §4.2 (closure maintenance).
 *
 * depth = 0 rows are self-references; depth > 0 are true ancestors.
 */
exports.up = function (knex) {
  return knex.schema.createTable('location_ancestors', (table) => {
    table.bigInteger('ancestor_id').unsigned().notNullable();
    table.bigInteger('descendant_id').unsigned().notNullable();
    table.integer('depth').notNullable();

    table.primary(['ancestor_id', 'descendant_id']);
    table.index('descendant_id', 'idx_la_descendant');
    table.foreign('ancestor_id').references('locations.id').onDelete('CASCADE');
    table.foreign('descendant_id').references('locations.id').onDelete('CASCADE');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('location_ancestors');
};
