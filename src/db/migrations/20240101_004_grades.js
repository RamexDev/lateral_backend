/**
 * Migration: grades
 * Shared, industry-standard grade matrix (Ethiopian Banking Grade Matrix).
 * See backend.md §3.2 (grades) and §4.3 (seeding).
 *
 * Shared across all banks — same 1–18 rank scale makes grade-adjacency matching
 * (BR-003) consistent across banks rather than comparing incompatible per-bank scales.
 */
exports.up = function (knex) {
  return knex.schema.createTable('grades', (table) => {
    table.increments('id').unsigned().primary();
    table.tinyint('grade_number').unsigned().notNullable().unique();
    table.string('band_label', 40).notNullable();
    table.string('band_label_am', 60).notNullable();
    table.string('tier_classification', 60).notNullable();
    table.string('tier_classification_am', 80).notNullable();
    table.string('typical_roles', 255).notNullable();
    table.string('typical_roles_am', 255).notNullable();
    table.integer('rank_order').notNullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('grades');
};
