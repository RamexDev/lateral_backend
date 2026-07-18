/**
 * Admin reference data management tests — banks, locations, grades (§6.9).
 * Covers RBAC: super_admin + platform_admin can mutate, finance_officer + support_officer cannot.
 */
const request = require('supertest');
const { app, loginStaff, getRefs } = require('./helpers');
const { Grade, Location, User } = require('../src/db/models');

describe('Admin banks (§6.9)', () => {
  it('super_admin can list banks', async () => {
    const { token } = await loginStaff('super_admin');
    const res = await request(app)
      .get('/admin/api/v1/banks')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.banks.length).toBeGreaterThan(0);
    expect(res.body.data.banks[0]).toHaveProperty('nickname');
  });

  it('super_admin can create a new bank', async () => {
    const { token } = await loginStaff('super_admin');
    const res = await request(app)
      .post('/admin/api/v1/banks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Bank S.C.',
        nameAm: 'ቴስት ባንክ',
        nickname: `testbank-${Date.now()}`,
        swiftCode: 'TESTETAA',
        yearEstablished: 2024,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeGreaterThan(0);
  });

  it('rejects a duplicate nickname (DUPLICATE_NICKNAME)', async () => {
    const { token } = await loginStaff('super_admin');
    const nickname = `dup-${Date.now()}`;
    await request(app).post('/admin/api/v1/banks').set('Authorization', `Bearer ${token}`).send({
      name: 'First Bank',
      nameAm: 'ፊርስት ባንክ',
      nickname,
    });
    const second = await request(app)
      .post('/admin/api/v1/banks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Second Bank',
        nameAm: 'ሰከንድ ባንክ',
        nickname,
      });
    expect(second.status).toBe(422);
    expect(second.body.error.code).toBe('DUPLICATE_NICKNAME');
  });

  it('super_admin can edit a bank', async () => {
    const { token } = await loginStaff('super_admin');
    const create = await request(app)
      .post('/admin/api/v1/banks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Edit Me Bank',
        nameAm: 'ኤዲት ሚ ባንክ',
        nickname: `editme-${Date.now()}`,
      });
    const res = await request(app)
      .patch(`/admin/api/v1/banks/${create.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Edited Bank' });
    expect(res.status).toBe(200);
    expect(res.body.data.updated).toBe(true);
  });

  it('rejects deactivating a bank with active users (BANK_HAS_ACTIVE_USERS)', async () => {
    const { token } = await loginStaff('super_admin');
    const newBank = await request(app)
      .post('/admin/api/v1/banks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Active Users Bank',
        nameAm: 'አክቲቭ ዩዘርስ ባንክ',
        nickname: `activeusers-${Date.now()}`,
      });
    const grade = await Grade.findOne({ raw: true });
    const zone = await Location.findOne({
      where: { level_type: 'zone_subcity' },
      raw: true,
    });
    await User.create({
      telegram_id: Math.floor(Math.random() * 1e9),
      phone_number: '+251900000099',
      bank_id: newBank.body.data.id,
      current_location_id: zone.id,
      branch_name: 'X Branch',
      grade_id: grade.id,
      is_active: true,
    });
    const res = await request(app)
      .patch(`/admin/api/v1/banks/${newBank.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('BANK_HAS_ACTIVE_USERS');
  });

  it('finance_officer cannot create banks (INSUFFICIENT_ROLE)', async () => {
    const { token } = await loginStaff('finance_officer');
    const res = await request(app)
      .post('/admin/api/v1/banks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Should Fail',
        nameAm: 'ሺልድ ፌል',
        nickname: `shouldfail-${Date.now()}`,
      });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('support_officer cannot create banks (INSUFFICIENT_ROLE)', async () => {
    const { token } = await loginStaff('support_officer');
    const res = await request(app)
      .post('/admin/api/v1/banks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Should Fail',
        nameAm: 'ሺልድ ፌል',
        nickname: `shouldfail2-${Date.now()}`,
      });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('platform_admin can create banks', async () => {
    const { token } = await loginStaff('platform_admin');
    const res = await request(app)
      .post('/admin/api/v1/banks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Platform Bank',
        nameAm: 'ፕላትፎርም ባንክ',
        nickname: `platform-${Date.now()}`,
      });
    expect(res.status).toBe(201);
  });
});

describe('Admin locations (§6.9)', () => {
  it('super_admin can create a region', async () => {
    const { token } = await loginStaff('super_admin');
    const res = await request(app)
      .post('/admin/api/v1/locations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'New Region',
        nameAm: 'ኒው ሪጅን',
        levelType: 'region',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeGreaterThan(0);
    expect(res.body.data.closureRebuildQueued).toBe(true);
  });

  it('super_admin can create a zone under a region', async () => {
    const { token } = await loginStaff('super_admin');
    const region = await request(app)
      .post('/admin/api/v1/locations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Zone Test Region',
        nameAm: 'ዞን ቴስት ሪጅን',
        levelType: 'region',
      });
    const res = await request(app)
      .post('/admin/api/v1/locations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'New Zone',
        nameAm: 'ኒው ዞን',
        levelType: 'zone_subcity',
        parentId: region.body.data.id,
      });
    expect(res.status).toBe(201);
  });

  it('rejects a zone without a parent (PARENT_REQUIRED)', async () => {
    const { token } = await loginStaff('super_admin');
    const res = await request(app)
      .post('/admin/api/v1/locations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Orphan Zone',
        nameAm: 'ኦርፋን ዞን',
        levelType: 'zone_subcity',
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PARENT_REQUIRED');
  });

  it('rejects a region with a parent (REGION_CANNOT_HAVE_PARENT)', async () => {
    const { token } = await loginStaff('super_admin');
    const refs = await getRefs();
    const res = await request(app)
      .post('/admin/api/v1/locations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Bad Region',
        nameAm: 'ባድ ሪጅን',
        levelType: 'region',
        parentId: refs.regions['Oromia'].id,
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('REGION_CANNOT_HAVE_PARENT');
  });

  it('finance_officer cannot create locations (INSUFFICIENT_ROLE)', async () => {
    const { token } = await loginStaff('finance_officer');
    const res = await request(app)
      .post('/admin/api/v1/locations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Should Fail',
        nameAm: 'ሺልድ ፌል',
        levelType: 'region',
      });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
  });
});

describe('Admin grades (§6.9)', () => {
  it('super_admin can create a new grade', async () => {
    const { token } = await loginStaff('super_admin');
    const res = await request(app)
      .post('/admin/api/v1/grades')
      .set('Authorization', `Bearer ${token}`)
      .send({
        gradeNumber: 19,
        bandLabel: 'Grade 18+',
        bandLabelAm: 'ደረጃ 18+',
        tierClassification: 'Executive',
        tierClassificationAm: 'ኤግዚኩቲቭ',
        typicalRoles: 'Group CEO',
        typicalRolesAm: 'ግሩፕ CEO',
        rankOrder: 19,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeGreaterThan(0);
  });

  it('rejects a duplicate grade number (DUPLICATE_GRADE_NUMBER)', async () => {
    const { token } = await loginStaff('super_admin');
    const res = await request(app)
      .post('/admin/api/v1/grades')
      .set('Authorization', `Bearer ${token}`)
      .send({
        gradeNumber: 7,
        bandLabel: 'Grades 6-9',
        bandLabelAm: 'ደረጃዎች 6-9',
        tierClassification: 'Junior Professional',
        tierClassificationAm: 'ጁኒየር ፕሮፌሽናል',
        typicalRoles: 'CSO I',
        typicalRolesAm: 'CSO I',
        rankOrder: 7,
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('DUPLICATE_GRADE_NUMBER');
  });

  it('super_admin can update a grade', async () => {
    const { token } = await loginStaff('super_admin');
    const create = await request(app)
      .post('/admin/api/v1/grades')
      .set('Authorization', `Bearer ${token}`)
      .send({
        gradeNumber: 20,
        bandLabel: 'Grade 20',
        bandLabelAm: 'ደረጃ 20',
        tierClassification: 'Board',
        tierClassificationAm: 'ቦርድ',
        typicalRoles: 'Chairman',
        typicalRolesAm: 'ሰብልክ',
        rankOrder: 20,
      });
    const res = await request(app)
      .patch(`/admin/api/v1/grades/${create.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ bandLabel: 'Grade 20+' });
    expect(res.status).toBe(200);
    expect(res.body.data.updated).toBe(true);
  });

  it('support_officer cannot create grades (INSUFFICIENT_ROLE)', async () => {
    const { token } = await loginStaff('support_officer');
    const res = await request(app)
      .post('/admin/api/v1/grades')
      .set('Authorization', `Bearer ${token}`)
      .send({
        gradeNumber: 21,
        bandLabel: 'Grade 21',
        bandLabelAm: 'ደረጃ 21',
        tierClassification: 'X',
        tierClassificationAm: 'X',
        typicalRoles: 'X',
        typicalRolesAm: 'X',
        rankOrder: 21,
      });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
  });
});
