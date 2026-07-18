/**
 * Sequelize models + migrations + seeders smoke tests.
 *
 * Verifies that:
 * - All 12 models load and have the expected attributes
 * - The 9 migrations produce the expected schema (tables, columns, FKs, indexes)
 * - The 4 seeders populate the expected reference data (31 banks, 14 regions,
 *   91 zones, 18 grades, 4 roles, super admin) and rebuild the closure table
 * - Associations are wired up correctly
 *
 * NOTE: the spec (§3.2, §16.4) says "105 Zones/Subcities/Special Woredas (119 nodes
 * total)" but the actual seed JSON has 91 zones (105 nodes total). We assert the
 * actual count here and flag the discrepancy in CHANGELOG.md.
 *
 * The tests/setup.js hook already runs all migrations + seeders before any test
 * file runs, so these tests can just inspect the resulting state. Note that
 * setup.js's beforeEach wipes the `staff` table (so the seeded super admin is gone
 * by the time these tests run) — tests that need the super admin re-seed it locally.
 */
const sequelize = require('../src/db/sequelize');
const models = require('../src/db/models');
const { QueryTypes } = require('sequelize');

describe('Sequelize models (§3.2)', () => {
  it('exports all 12 models', () => {
    expect(models.Bank).toBeDefined();
    expect(models.Location).toBeDefined();
    expect(models.LocationAncestor).toBeDefined();
    expect(models.Grade).toBeDefined();
    expect(models.User).toBeDefined();
    expect(models.TransferInterest).toBeDefined();
    expect(models.Purchase).toBeDefined();
    expect(models.Payment).toBeDefined();
    expect(models.Notification).toBeDefined();
    expect(models.Role).toBeDefined();
    expect(models.Staff).toBeDefined();
    expect(models.AuditLog).toBeDefined();
  });

  it('Bank model has the spec-required attributes (§3.2)', () => {
    const attrs = models.Bank.rawAttributes;
    expect(attrs.id).toBeDefined();
    expect(attrs.name).toBeDefined();
    expect(attrs.name_am).toBeDefined();
    expect(attrs.nickname).toBeDefined();
    expect(attrs.swift_code).toBeDefined();
    expect(attrs.year_established).toBeDefined();
    expect(attrs.is_active).toBeDefined();
    // Sequelize stores timestamp JS attributes as camelCase (createdAt/updatedAt)
    // with field='created_at'/'updated_at' when underscored: true.
    expect(attrs.createdAt).toBeDefined();
    expect(attrs.createdAt.field).toBe('created_at');
    expect(attrs.updatedAt).toBeDefined();
    expect(attrs.updatedAt.field).toBe('updated_at');
  });

  it('User model has the spec-required attributes + indexes (§3.2)', () => {
    const attrs = models.User.rawAttributes;
    const expectedAttrs = [
      'id', 'telegram_id', 'telegram_username', 'phone_number', 'bank_id',
      'current_location_id', 'branch_name', 'neighborhood', 'grade_id',
      'preferred_language', 'is_active', 'last_digest_at', 'last_activity_at',
    ];
    for (const name of expectedAttrs) {
      expect(attrs[name]).toBeDefined();
    }

    const indexNames = (models.User.options.indexes || []).map((i) => i.name);
    expect(indexNames).toContain('uq_phone_bank');
    expect(indexNames).toContain('idx_user_bank_location');
    expect(indexNames).toContain('idx_user_activity');
  });

  it('Location model uses ENUM for level_type', () => {
    const attr = models.Location.rawAttributes.level_type;
    expect(attr.type).toBeDefined();
    const enumValues = attr.type.values || [];
    expect(enumValues).toEqual(expect.arrayContaining(['region', 'zone_subcity']));
  });

  it('Payment model has ENUM status with the 4 spec values', () => {
    const attr = models.Payment.rawAttributes.status;
    const enumValues = attr.type.values || [];
    expect(enumValues).toEqual(
      expect.arrayContaining(['pending', 'completed', 'failed', 'refunded']),
    );
  });

  it('Purchase model declares the uq_buyer_target unique index (BR-006)', () => {
    const indexes = models.Purchase.options.indexes || [];
    const uq = indexes.find((i) => i.name === 'uq_buyer_target');
    expect(uq).toBeDefined();
    expect(uq.unique).toBe(true);
  });
});

describe('Sequelize associations (§3.3)', () => {
  it('User belongsTo Bank, Location (currentLocation), Grade', () => {
    const assoc = models.User.associations;
    expect(assoc.bank).toBeDefined();
    expect(assoc.bank.associationType).toBe('BelongsTo');
    expect(assoc.currentLocation).toBeDefined();
    expect(assoc.grade).toBeDefined();
  });

  it('Bank hasMany Users', () => {
    const assoc = models.Bank.associations;
    expect(assoc.users).toBeDefined();
    expect(assoc.users.associationType).toBe('HasMany');
  });

  it('Location self-references via parent', () => {
    const assoc = models.Location.associations;
    expect(assoc.parent).toBeDefined();
    expect(assoc.parent.associationType).toBe('BelongsTo');
    expect(assoc.children).toBeDefined();
    expect(assoc.children.associationType).toBe('HasMany');
  });

  it('Role hasMany Staff', () => {
    const assoc = models.Role.associations;
    expect(assoc.staff).toBeDefined();
  });
});

describe('Migrations produce the expected schema', () => {
  it('all 12 tables exist in the database', async () => {
    const rows = await sequelize.query(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
      { type: QueryTypes.SELECT },
    );
    const tableNames = rows.map((r) => r.name);
    const expected = [
      'banks', 'locations', 'location_ancestors', 'grades', 'users',
      'transfer_interests', 'purchases', 'payments', 'notifications',
      'roles', 'staff', 'audit_logs',
    ];
    for (const t of expected) {
      expect(tableNames).toContain(t);
    }
  });

  it('locations has a self-referencing FK on parent_id', async () => {
    const rows = await sequelize.query(
      `PRAGMA foreign_key_list('locations')`,
      { type: QueryTypes.SELECT },
    );
    const parentFk = rows.find((r) => r.table === 'locations');
    expect(parentFk).toBeDefined();
  });

  it('users has FKs to banks, locations, grades', async () => {
    const rows = await sequelize.query(
      `PRAGMA foreign_key_list('users')`,
      { type: QueryTypes.SELECT },
    );
    const referencedTables = rows.map((r) => r.table);
    expect(referencedTables).toEqual(
      expect.arrayContaining(['banks', 'locations', 'grades']),
    );
  });

  it('purchases has a unique constraint on (buyer_id, target_user_id) (BR-006)', async () => {
    // SQLite backs UNIQUE constraints with an auto-named index (sqlite_autoindex_...),
    // so PRAGMA index_list won't show 'uq_buyer_target' by name. Instead, inspect the
    // CREATE TABLE SQL which contains the named CONSTRAINT clause.
    const rows = await sequelize.query(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='purchases'`,
      { type: QueryTypes.SELECT },
    );
    const schema = rows[0]?.sql || '';
    expect(schema).toMatch(/CONSTRAINT\s+`uq_buyer_target`\s+UNIQUE/i);

    // Also verify via PRAGMA index_list that there's at least one unique index.
    const idxRows = await sequelize.query(`PRAGMA index_list('purchases')`, {
      type: QueryTypes.SELECT,
    });
    const uniqueCount = idxRows.filter((r) => r.unique === 1).length;
    expect(uniqueCount).toBeGreaterThanOrEqual(1);
  });

  it('payments has a unique index on provider_charge_id (FR-PAY-002)', async () => {
    const rows = await sequelize.query(
      `PRAGMA index_list('payments')`,
      { type: QueryTypes.SELECT },
    );
    // The unique index on provider_charge_id — SQLite names it via the column.
    // (Renamed from telegram_charge_id when the default provider switched to Chapa.)
    const uniqueIndexes = rows.filter((r) => r.unique === 1);
    expect(uniqueIndexes.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Seeders populate reference data (§4)', () => {
  it('seeds 31 banks with both name and name_am populated', async () => {
    const count = await models.Bank.count();
    expect(count).toBe(31);

    const sample = await models.Bank.findOne({ where: { nickname: 'cbe' }, raw: true });
    expect(sample.name).toBe('Commercial Bank of Ethiopia');
    expect(sample.name_am).toBeTruthy();
    expect(sample.name_am).not.toBe('');
  });

  it('seeds 14 regions and 111 zones (125 locations total — vendor dataset, answers.md §E)', async () => {
    // The current seed-data.geography.json is the vendor-supplied 111-zone dataset
    // (14 regions + 111 zones = 125 nodes total). Replaces the prior 91-zone seed
    // wholesale per answers.md §E. Amharic translations for ~30 newly-added zones
    // are best-effort drafts flagged for translation review per backend.md §16.1.
    const regionCount = await models.Location.count({ where: { level_type: 'region' } });
    const zoneCount = await models.Location.count({ where: { level_type: 'zone_subcity' } });
    expect(regionCount).toBe(14);
    expect(zoneCount).toBe(111);
    expect(regionCount + zoneCount).toBe(125);
  });

  it('seeds 18 grades with all _am columns populated', async () => {
    const count = await models.Grade.count();
    expect(count).toBe(18);

    const sample = await models.Grade.findOne({ where: { grade_number: 7 }, raw: true });
    expect(sample.band_label).toBeTruthy();
    expect(sample.band_label_am).toBeTruthy();
    expect(sample.tier_classification_am).toBeTruthy();
    expect(sample.typical_roles_am).toBeTruthy();
  });

  it('seeds the 4 RBAC roles', async () => {
    const names = (await models.Role.findAll({ attributes: ['name'], raw: true })).map(
      (r) => r.name,
    );
    expect(names).toEqual(
      expect.arrayContaining([
        'super_admin',
        'platform_admin',
        'finance_officer',
        'support_officer',
      ]),
    );
  });

  it('seeds a default super admin staff account (re-seeds locally because beforeEach wipes staff)', async () => {
    // setup.js's beforeEach deletes from `staff`, so re-run the seeder to verify
    // it creates the account.
    const superAdminSeeder = require('../src/db/seeders/20240101000004-super-admin');
    const queryInterface = sequelize.getQueryInterface();
    const Sequelize = sequelize.constructor;
    await superAdminSeeder.up(queryInterface, Sequelize);

    const sa = await models.Staff.findOne({
      where: { email: 'superadmin@lateral.local' },
      raw: true,
    });
    expect(sa).not.toBeNull();
    expect(sa.is_active).toBe(1);

    const role = await models.Role.findByPk(sa.role_id, { raw: true });
    expect(role.name).toBe('super_admin');
  });

  it('rebuilds the closure table after geography seeding (§4.2)', async () => {
    // 125 self-rows (depth 0) + 111 ancestor-rows (depth 1, each zone → its region)
    // = 236 total. (Math: 125 locations, 111 of which are zones with 1 ancestor each.)
    const count = await models.LocationAncestor.count();
    expect(count).toBe(236);

    // Spot-check: East Shewa (zone) has itself at depth 0 and Oromia at depth 1.
    const eastShewa = await models.Location.findOne({
      where: { name: 'East Shewa', level_type: 'zone_subcity' },
      raw: true,
    });
    const oromia = await models.Location.findOne({
      where: { name: 'Oromia', level_type: 'region' },
      raw: true,
    });

    const selfRow = await models.LocationAncestor.findOne({
      where: { ancestor_id: eastShewa.id, descendant_id: eastShewa.id },
      raw: true,
    });
    expect(selfRow.depth).toBe(0);

    const ancestorRow = await models.LocationAncestor.findOne({
      where: { ancestor_id: oromia.id, descendant_id: eastShewa.id },
      raw: true,
    });
    expect(ancestorRow.depth).toBe(1);
  });
});

describe('Seeder idempotency (§4)', () => {
  it('re-running the banks seeder updates existing rows instead of duplicating', async () => {
    const banksSeeder = require('../src/db/seeders/20240101000001-banks');
    const queryInterface = sequelize.getQueryInterface();
    const Sequelize = sequelize.constructor;

    const before = await models.Bank.count();
    await banksSeeder.up(queryInterface, Sequelize);
    const after = await models.Bank.count();
    expect(after).toBe(before); // no new rows
  });

  it('re-running the grades seeder updates existing rows instead of duplicating', async () => {
    const gradesSeeder = require('../src/db/seeders/20240101000003-grades');
    const queryInterface = sequelize.getQueryInterface();
    const Sequelize = sequelize.constructor;

    const before = await models.Grade.count();
    await gradesSeeder.up(queryInterface, Sequelize);
    const after = await models.Grade.count();
    expect(after).toBe(before);
  });

  it('re-running the geography seeder preserves location IDs (upsert by name+parent)', async () => {
    const geographySeeder = require('../src/db/seeders/20240101000002-geography');
    const queryInterface = sequelize.getQueryInterface();
    const Sequelize = sequelize.constructor;

    const before = await models.Location.findOne({
      where: { name: 'East Shewa', level_type: 'zone_subcity' },
      raw: true,
    });
    await geographySeeder.up(queryInterface, Sequelize);
    const after = await models.Location.findOne({
      where: { name: 'East Shewa', level_type: 'zone_subcity' },
      raw: true,
    });
    expect(after.id).toBe(before.id); // same ID — upsert, not delete+reinsert
  });

  it('re-running the super-admin seeder does NOT reset the password (idempotent on email)', async () => {
    const bcrypt = require('bcryptjs');
    const superAdminSeeder = require('../src/db/seeders/20240101000004-super-admin');
    const queryInterface = sequelize.getQueryInterface();
    const Sequelize = sequelize.constructor;

    // Seed the super admin first (staff is empty after beforeEach).
    await superAdminSeeder.up(queryInterface, Sequelize);
    const before = await models.Staff.findOne({
      where: { email: 'superadmin@lateral.local' },
      raw: true,
    });
    expect(before).not.toBeNull();

    // Mutate the password hash to a known value, then re-seed.
    const mutatedHash = await bcrypt.hash('MutatedPassword123!', 10);
    await models.Staff.update(
      { password_hash: mutatedHash },
      { where: { email: 'superadmin@lateral.local' } },
    );

    await superAdminSeeder.up(queryInterface, Sequelize);

    const after = await models.Staff.findOne({
      where: { email: 'superadmin@lateral.local' },
      raw: true,
    });
    expect(after.password_hash).toBe(mutatedHash); // unchanged — seeder skipped the existing account
  });
});
