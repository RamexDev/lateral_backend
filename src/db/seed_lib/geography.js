/**
 * Seed: banks + locations (Ethiopian Banks + Geographic Hierarchy).
 * See backend.md §4.1, §16.4 — both English and Amharic names are populated.
 *
 * Idempotent: upserts by (name, parent_id) for locations and by nickname for banks.
 * Runs the closure-table rebuild after seeding locations.
 */

const banksSeed = require('./seed-data.banks.json');
const geographySeed = require('./seed-data.geography.json');
const bankRepo = require('../../repositories/bankRepository');
const db = require('../../db/knex');
const locationService = require('../../services/locationService');
const logger = require('../../utils/logger');

async function seedBanks() {
  let count = 0;
  for (const bank of banksSeed.banks) {
    const existing = await bankRepo.findByNickname(bank.nickname);
    if (existing) {
      await bankRepo.update(existing.id, {
        name: bank.name,
        name_am: bank.nameAm,
        swift_code: bank.swiftCode ?? null,
        year_established: bank.yearEstablished ?? null,
        is_active: bank.status !== 'Inactive',
      });
    } else {
      await bankRepo.create({
        name: bank.name,
        name_am: bank.nameAm,
        nickname: bank.nickname,
        swift_code: bank.swiftCode ?? null,
        year_established: bank.yearEstablished ?? null,
        is_active: bank.status !== 'Inactive',
      });
    }
    count += 1;
  }
  logger.info(`Seeded ${count} banks`);
  return count;
}

async function seedGeography() {
  let regionCount = 0;
  let zoneCount = 0;

  for (const region of geographySeed.regions) {
    // Upsert region by name (top-level, no parent).
    let regionRow = await db('locations')
      .where({ name: region.name, level_type: 'region' })
      .first();
    if (!regionRow) {
      const [id] = await db('locations').insert({
        parent_id: null,
        name: region.name,
        name_am: region.nameAm,
        level_type: 'region',
        is_active: true,
      });
      regionRow = { id };
    } else {
      await db('locations').where({ id: regionRow.id }).update({
        name: region.name,
        name_am: region.nameAm,
      });
    }
    regionCount += 1;

    for (const zone of region.zones_subcities || []) {
      const zoneRow = await db('locations')
        .where({ name: zone.name, parent_id: regionRow.id })
        .first();
      if (!zoneRow) {
        await db('locations').insert({
          parent_id: regionRow.id,
          name: zone.name,
          name_am: zone.nameAm,
          level_type: 'zone_subcity',
          is_active: true,
        });
      } else {
        await db('locations').where({ id: zoneRow.id }).update({
          name: zone.name,
          name_am: zone.nameAm,
        });
      }
      zoneCount += 1;
    }
  }

  // Rebuild closure table after seeding.
  await locationService.rebuildClosure();

  logger.info(`Seeded ${regionCount} regions and ${zoneCount} zones`);
  return { regionCount, zoneCount };
}

module.exports = { seedBanks, seedGeography };
