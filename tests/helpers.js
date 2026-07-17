/**
 * Test helpers — shared utilities for registering users, issuing tokens,
 * and logging in as staff. Keeps test files small and focused on assertions.
 *
 * Reference data IDs are looked up by NAME (not hardcoded) so tests don't break
 * if the seed data order changes.
 */
const request = require('supertest');
const app = require('../src/app').createApp();
const db = require('./db');
const authService = require('../src/services/authService');
const staffRepo = require('../src/repositories/staffRepository');
const passwordUtil = require('../src/utils/password');

// Cached reference-data lookups (filled lazily on first call).
let refCache = null;

/**
 * Look up reference data IDs by name. Cached for the lifetime of the worker.
 * Returns: { banks: { cbe: {id, ...}, ... }, regions: { 'Oromia': {id}, ... }, zones: { 'East Shewa': {id}, ... }, grades: { 7: {id, bandLabel}, ... } }
 */
async function getRefs() {
  if (refCache) return refCache;

  const banks = await db('banks').select('id', 'nickname', 'name');
  const regions = await db('locations').select('id', 'name').where({ level_type: 'region' });
  const zones = await db('locations')
    .select('id', 'name', 'parent_id')
    .where({ level_type: 'zone_subcity' });
  const grades = await db('grades').select('id', 'grade_number', 'band_label');

  refCache = {
    banks: Object.fromEntries(banks.map((b) => [b.nickname, b])),
    banksByName: Object.fromEntries(banks.map((b) => [b.name, b])),
    regions: Object.fromEntries(regions.map((r) => [r.name, r])),
    regionsById: Object.fromEntries(regions.map((r) => [r.id, r])),
    zones: Object.fromEntries(zones.map((z) => [z.name, z])),
    zonesById: Object.fromEntries(zones.map((z) => [z.id, z])),
    grades: Object.fromEntries(grades.map((g) => [g.grade_number, g])),
  };
  return refCache;
}

/**
 * Run the full onboarding wizard for a single user and return the user row + JWT.
 *
 * @param {object} opts
 * @param {number} opts.telegramId
 * @param {string} opts.username
 * @param {string} opts.phone
 * @param {string} opts.bankNickname  'cbe' | 'awash' | ... (default: 'cbe')
 * @param {string} opts.regionName    e.g. 'Oromia' (default)
 * @param {string} opts.zoneName      e.g. 'East Shewa' (default)
 * @param {number} opts.gradeNumber   1-18 (default 7)
 * @param {string} opts.language      'en' | 'am'
 * @param {string} opts.branchName
 * @param {string} opts.neighborhood
 */
async function registerUser(opts = {}) {
  const refs = await getRefs();
  const {
    telegramId = Math.floor(100000000 + Math.random() * 900000000),
    username = 'tester',
    phone = '+251911000000',
    bankNickname = 'cbe',
    regionName = 'Oromia',
    zoneName = 'East Shewa',
    gradeNumber = 7,
    language = 'en',
    branchName = 'Adama Main Branch',
    neighborhood = 'Bole Road',
  } = opts;

  const bank = refs.banks[bankNickname];
  const region = refs.regions[regionName];
  const zone = refs.zones[zoneName];
  const grade = refs.grades[gradeNumber];
  if (!bank || !region || !zone || !grade) {
    throw new Error(
      `Bad reference data lookup: bank=${bankNickname} region=${regionName} zone=${zoneName} grade=${gradeNumber}`,
    );
  }

  await request(app)
    .post('/api/v1/onboarding/start')
    .send({ telegramId, telegramUsername: username });
  await request(app).post('/api/v1/onboarding/language').send({ telegramId, language });
  await request(app)
    .post('/api/v1/onboarding/contact')
    .send({ telegramId, telegramUsername: username, phoneNumber: phone, contactIsSelf: true });
  await request(app).post('/api/v1/onboarding/bank').send({ telegramId, bankId: bank.id });
  await request(app).post('/api/v1/onboarding/region').send({ telegramId, regionId: region.id });
  await request(app).post('/api/v1/onboarding/zone').send({ telegramId, zoneId: zone.id });
  await request(app)
    .post('/api/v1/onboarding/branch-details')
    .send({ telegramId, branchName, neighborhood });
  await request(app)
    .post('/api/v1/onboarding/grade-band')
    .send({ telegramId, bandLabel: grade.band_label });
  await request(app).post('/api/v1/onboarding/grade').send({ telegramId, gradeId: grade.id });

  const user = await db('users').where({ telegram_id: telegramId }).first();
  const token = authService.issueUserToken(user);
  return { user, token, refs };
}

/**
 * Create a staff account with a given role and return login credentials + token.
 */
async function loginStaff(roleName = 'super_admin') {
  const email = `staff-${roleName}-${Date.now()}-${Math.floor(Math.random() * 10000)}@test.local`;
  const password = 'TestPassword123!';
  const role = await staffRepo.findRoleByName(roleName);
  const id = await staffRepo.create({
    full_name: `Test ${roleName}`,
    email,
    password_hash: await passwordUtil.hash(password),
    role_id: role.id,
    preferred_language: 'en',
    is_active: true,
  });
  const res = await request(app).post('/admin/api/v1/auth/login').send({ email, password });
  return {
    staffId: id,
    email,
    password,
    token: res.body.data.token,
  };
}

/**
 * Insert a transfer interest directly (skipping the wizard) for setup convenience.
 */
async function addInterest(userId, locationId) {
  const [id] = await db('transfer_interests').insert({ user_id: userId, location_id: locationId });
  return id;
}

module.exports = { registerUser, loginStaff, addInterest, getRefs, app };
