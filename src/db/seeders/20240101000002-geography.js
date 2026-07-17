/**
 * Sequelize seeder: geography (regions + zones/subcities).
 * See backend.md §4.1, §16.4 — both English and Amharic names are populated.
 *
 * Idempotent: upserts by (name, parent_id) for locations.
 * Rebuilds the closure table after seeding.
 *
 * Uses the Location model directly (rather than queryInterface.bulkInsert) so we
 * can retrieve inserted IDs portably across SQLite and MySQL — needed to wire up
 * the zone → region parent_id reference.
 */
const geographySeed = require('../seed_lib/seed-data.geography.json');
const { rebuildClosure } = require('../seed_lib/closureRebuild');

async function up(queryInterface, Sequelize) {
  // Lazy-require to avoid circular imports during initial model loading.
  const { Location } = require('../models');

  for (const region of geographySeed.regions) {
    // Upsert region by (name, level_type='region', parent_id IS NULL).
    let regionRow = await Location.findOne({
      where: { name: region.name, level_type: 'region', parent_id: null },
      raw: true,
    });

    if (regionRow) {
      await Location.update(
        { name: region.name, name_am: region.nameAm },
        { where: { id: regionRow.id } },
      );
    } else {
      const created = await Location.create({
        parent_id: null,
        name: region.name,
        name_am: region.nameAm,
        level_type: 'region',
        is_active: true,
      });
      regionRow = { id: created.id };
    }

    for (const zone of region.zones_subcities || []) {
      const existingZone = await Location.findOne({
        where: { name: zone.name, parent_id: regionRow.id, level_type: 'zone_subcity' },
        raw: true,
      });

      if (existingZone) {
        await Location.update(
          { name: zone.name, name_am: zone.nameAm },
          { where: { id: existingZone.id } },
        );
      } else {
        await Location.create({
          parent_id: regionRow.id,
          name: zone.name,
          name_am: zone.nameAm,
          level_type: 'zone_subcity',
          is_active: true,
        });
      }
    }
  }

  // Rebuild closure table after seeding.
  await rebuildClosure(queryInterface, Sequelize);
}

async function down(queryInterface) {
  await queryInterface.bulkDelete('location_ancestors', {});
  await queryInterface.bulkDelete('locations', {});
}

module.exports = { up, down };
