/**
 * Seed: grade matrix (Ethiopian Banking Grade Matrix).
 * See backend.md §4.3, §16.4 — shared across all banks, both English and Amharic.
 */
const gradesSeed = require('./grades-seed.json');
const gradeRepo = require('../../repositories/gradeRepository');
const logger = require('../../utils/logger');

async function seedGrades() {
  let count = 0;
  for (const g of gradesSeed.grades) {
    const existing = await gradeRepo.findByGradeNumber(g.gradeNumber);
    if (existing) {
      await gradeRepo.update(existing.id, {
        band_label: g.bandLabel,
        band_label_am: g.bandLabelAm,
        tier_classification: g.tierClassification,
        tier_classification_am: g.tierClassificationAm,
        typical_roles: g.typicalRoles,
        typical_roles_am: g.typicalRolesAm,
        rank_order: g.rankOrder ?? g.gradeNumber,
      });
    } else {
      await gradeRepo.create({
        grade_number: g.gradeNumber,
        band_label: g.bandLabel,
        band_label_am: g.bandLabelAm,
        tier_classification: g.tierClassification,
        tier_classification_am: g.tierClassificationAm,
        typical_roles: g.typicalRoles,
        typical_roles_am: g.typicalRolesAm,
        rank_order: g.rankOrder ?? g.gradeNumber,
        is_active: true,
      });
    }
    count += 1;
  }
  logger.info(`Seeded ${count} grades`);
  return count;
}

module.exports = { seedGrades };
