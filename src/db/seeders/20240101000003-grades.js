/**
 * Sequelize seeder: grade matrix (Ethiopian Banking Grade Matrix).
 * See backend.md §4.3, §16.4 — shared across all banks, both English and Amharic.
 *
 * Idempotent: upserts by `grade_number`.
 */
const gradesSeed = require('../seed_lib/grades-seed.json');

async function up(queryInterface, Sequelize) {
  const existing = await queryInterface.sequelize.query(
    `SELECT grade_number FROM grades`,
    { type: Sequelize.QueryTypes.SELECT },
  );
  const existingNumbers = new Set(existing.map((r) => r.grade_number));

  const toInsert = [];
  const toUpdate = [];
  for (const g of gradesSeed.grades) {
    if (existingNumbers.has(g.gradeNumber)) {
      toUpdate.push(g);
    } else {
      toInsert.push(g);
    }
  }

  if (toInsert.length) {
    await queryInterface.bulkInsert(
      'grades',
      toInsert.map((g) => ({
        grade_number: g.gradeNumber,
        band_label: g.bandLabel,
        band_label_am: g.bandLabelAm,
        tier_classification: g.tierClassification,
        tier_classification_am: g.tierClassificationAm,
        typical_roles: g.typicalRoles,
        typical_roles_am: g.typicalRolesAm,
        rank_order: g.rankOrder ?? g.gradeNumber,
        is_active: true,
      })),
    );
  }

  for (const g of toUpdate) {
    await queryInterface.bulkUpdate(
      'grades',
      {
        band_label: g.bandLabel,
        band_label_am: g.bandLabelAm,
        tier_classification: g.tierClassification,
        tier_classification_am: g.tierClassificationAm,
        typical_roles: g.typicalRoles,
        typical_roles_am: g.typicalRolesAm,
        rank_order: g.rankOrder ?? g.gradeNumber,
      },
      { grade_number: g.gradeNumber },
    );
  }
}

async function down(queryInterface) {
  const numbers = gradesSeed.grades.map((g) => g.gradeNumber);
  await queryInterface.bulkDelete('grades', { grade_number: numbers });
}

module.exports = { up, down };
