/**
 * Sequelize seeder: banks.
 * See backend.md §4.1, §16.4 — both English and Amharic names are populated.
 *
 * Idempotent: upserts by `nickname`.
 */
const banksSeed = require('../seed_lib/seed-data.banks.json');

async function up(queryInterface, Sequelize) {
  const existing = await queryInterface.sequelize.query(
    `SELECT nickname FROM banks`,
    { type: Sequelize.QueryTypes.SELECT },
  );
  const existingNicknames = new Set(existing.map((r) => r.nickname));

  const toInsert = [];
  const toUpdate = [];
  for (const bank of banksSeed.banks) {
    if (existingNicknames.has(bank.nickname)) {
      toUpdate.push(bank);
    } else {
      toInsert.push(bank);
    }
  }

  if (toInsert.length) {
    await queryInterface.bulkInsert(
      'banks',
      toInsert.map((b) => ({
        name: b.name,
        name_am: b.nameAm,
        nickname: b.nickname,
        swift_code: b.swiftCode ?? null,
        year_established: b.yearEstablished ?? null,
        is_active: b.status !== 'Inactive',
      })),
    );
  }

  for (const b of toUpdate) {
    await queryInterface.bulkUpdate(
      'banks',
      {
        name: b.name,
        name_am: b.nameAm,
        swift_code: b.swiftCode ?? null,
        year_established: b.yearEstablished ?? null,
        is_active: b.status !== 'Inactive',
      },
      { nickname: b.nickname },
    );
  }
}

async function down(queryInterface) {
  // Only remove banks that came from the seed (best-effort via nickname match).
  const nicknames = banksSeed.banks.map((b) => b.nickname);
  await queryInterface.bulkDelete('banks', { nickname: nicknames });
}

module.exports = { up, down };
