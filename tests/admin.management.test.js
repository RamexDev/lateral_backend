/**
 * Admin staff + user management + notifications + reports tests (§6.9, §6.10).
 */
const request = require('supertest');
const { app, loginStaff, registerUser, getRefs } = require('./helpers');

describe('Admin staff management (§6.9)', () => {
  it('super_admin can list staff', async () => {
    const { token } = await loginStaff('super_admin');
    const res = await request(app)
      .get('/admin/api/v1/staff')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.staff)).toBe(true);
  });

  it('super_admin can create a new staff account', async () => {
    const { token } = await loginStaff('super_admin');
    const res = await request(app)
      .post('/admin/api/v1/staff')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'New Staff',
        email: `newstaff-${Date.now()}@test.local`,
        password: 'Password123!',
        roleName: 'platform_admin',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeGreaterThan(0);
  });

  it('super_admin can list roles', async () => {
    const { token } = await loginStaff('super_admin');
    const res = await request(app)
      .get('/admin/api/v1/staff/roles')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const names = res.body.data.roles.map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'super_admin',
        'platform_admin',
        'finance_officer',
        'support_officer',
      ]),
    );
  });

  it('platform_admin cannot manage staff (INSUFFICIENT_ROLE)', async () => {
    const { token } = await loginStaff('platform_admin');
    const res = await request(app)
      .post('/admin/api/v1/staff')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Should Fail',
        email: `shouldfail-${Date.now()}@test.local`,
        password: 'Password123!',
        roleName: 'support_officer',
      });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('finance_officer cannot list staff (INSUFFICIENT_ROLE)', async () => {
    const { token } = await loginStaff('finance_officer');
    const res = await request(app)
      .get('/admin/api/v1/staff')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
  });
});

describe('Admin user status management (§6.9)', () => {
  it('super_admin can deactivate a user', async () => {
    const { token } = await loginStaff('super_admin');
    const { user } = await registerUser({ telegramId: 5001, phone: '+251911000501' });
    const res = await request(app)
      .patch(`/admin/api/v1/users/${user.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false, reason: 'Test deactivation' });
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
  });

  it('support_officer can also deactivate users', async () => {
    const { token } = await loginStaff('support_officer');
    const { user } = await registerUser({ telegramId: 5002, phone: '+251911000502' });
    const res = await request(app)
      .patch(`/admin/api/v1/users/${user.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });
    expect(res.status).toBe(200);
  });

  it('finance_officer cannot deactivate users (INSUFFICIENT_ROLE)', async () => {
    const { token } = await loginStaff('finance_officer');
    const { user } = await registerUser({ telegramId: 5003, phone: '+251911000503' });
    const res = await request(app)
      .patch(`/admin/api/v1/users/${user.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('returns 404 for a non-existent user', async () => {
    const { token } = await loginStaff('super_admin');
    const res = await request(app)
      .patch('/admin/api/v1/users/9999999/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('Admin user monitoring (§6.10)', () => {
  it('super_admin can list users (phone is masked)', async () => {
    const { token } = await loginStaff('super_admin');
    await registerUser({ telegramId: 5101, phone: '+251911000601' });
    const res = await request(app)
      .get('/admin/api/v1/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.users.length).toBeGreaterThan(0);
    expect(res.body.data.users[0].phone).toMatch(/\*/);
  });

  it('super_admin can fetch a user detail (full phone)', async () => {
    const { token } = await loginStaff('super_admin');
    const { user } = await registerUser({ telegramId: 5102, phone: '+251911000602' });
    const res = await request(app)
      .get(`/admin/api/v1/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(user.id);
    expect(res.body.data.profile.bankName).toBe('Commercial Bank of Ethiopia');
    expect(res.body.data.profile.phone).toBe('+251911000602');
    expect(res.body.data.stats).toBeDefined();
    expect(Array.isArray(res.body.data.activity)).toBe(true);
  });

  it('returns 404 for a non-existent user detail', async () => {
    const { token } = await loginStaff('super_admin');
    const res = await request(app)
      .get('/admin/api/v1/users/9999999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('filters users by bankId', async () => {
    const { token } = await loginStaff('super_admin');
    const refs = await getRefs();
    const res = await request(app)
      .get(`/admin/api/v1/users?bankId=${refs.banks.cbe.id}&pageSize=100`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.users.every((u) => u.bankId === refs.banks.cbe.id)).toBe(true);
  });
});

describe('Admin notifications broadcast (§6.8)', () => {
  it('super_admin can broadcast to all users', async () => {
    const { token } = await loginStaff('super_admin');
    await registerUser({ telegramId: 5201, phone: '+251911000701' });

    const res = await request(app)
      .post('/admin/api/v1/notifications/broadcast')
      .set('Authorization', `Bearer ${token}`)
      .send({
        segmentFilter: { scope: 'all' },
        message: { en: 'Maintenance tonight', am: 'የጥገና ስራ ዛሬ ማታ' },
      });
    expect(res.status).toBe(200);
    expect(res.body.data.queuedRecipients).toBeGreaterThan(0);
  });

  it('rejects a broadcast to an empty segment (EMPTY_SEGMENT)', async () => {
    const { token } = await loginStaff('super_admin');
    const res = await request(app)
      .post('/admin/api/v1/notifications/broadcast')
      .set('Authorization', `Bearer ${token}`)
      .send({
        segmentFilter: { scope: 'bank', bankId: 999999 },
        message: { en: 'x', am: 'x' },
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('EMPTY_SEGMENT');
  });

  it('rejects a zone scope where zoneId is a region (INVALID_ZONE)', async () => {
    const { token } = await loginStaff('super_admin');
    const refs = await getRefs();
    const res = await request(app)
      .post('/admin/api/v1/notifications/broadcast')
      .set('Authorization', `Bearer ${token}`)
      .send({
        segmentFilter: { scope: 'zone', zoneId: refs.regions['Oromia'].id },
        message: { en: 'x', am: 'x' },
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_ZONE');
  });

  it('rejects scope=region without regionId (FILTER_INCOMPLETE)', async () => {
    const { token } = await loginStaff('super_admin');
    const res = await request(app)
      .post('/admin/api/v1/notifications/broadcast')
      .set('Authorization', `Bearer ${token}`)
      .send({
        segmentFilter: { scope: 'region' },
        message: { en: 'x', am: 'x' },
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('FILTER_INCOMPLETE');
  });

  it('support_officer cannot broadcast (INSUFFICIENT_ROLE)', async () => {
    const { token } = await loginStaff('support_officer');
    const res = await request(app)
      .post('/admin/api/v1/notifications/broadcast')
      .set('Authorization', `Bearer ${token}`)
      .send({
        segmentFilter: { scope: 'all' },
        message: { en: 'x', am: 'x' },
      });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
  });
});

describe('Admin reports & dashboard (§6.10)', () => {
  it('super_admin can fetch dashboard summary', async () => {
    const { token } = await loginStaff('super_admin');
    const res = await request(app)
      .get('/admin/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('activeUsers');
    expect(res.body.data).toHaveProperty('totalInterests');
    expect(res.body.data).toHaveProperty('totalPurchases');
    expect(res.body.data).toHaveProperty('revenueEtb');
  });

  it('finance_officer can fetch dashboard summary (read-only)', async () => {
    const { token } = await loginStaff('finance_officer');
    const res = await request(app)
      .get('/admin/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('super_admin can fetch revenue report', async () => {
    const { token } = await loginStaff('super_admin');
    const res = await request(app)
      .get('/admin/api/v1/reports/revenue')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('revenueEtb');
    expect(res.body.data).toHaveProperty('purchaseCount');
    expect(Array.isArray(res.body.data.byBank)).toBe(true);
  });

  it('platform_admin cannot view revenue reports (INSUFFICIENT_ROLE)', async () => {
    const { token } = await loginStaff('platform_admin');
    const res = await request(app)
      .get('/admin/api/v1/reports/revenue')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('finance_officer can view revenue reports', async () => {
    const { token } = await loginStaff('finance_officer');
    const res = await request(app)
      .get('/admin/api/v1/reports/revenue')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('revenue export returns CSV', async () => {
    const { token } = await loginStaff('super_admin');
    const res = await request(app)
      .get('/admin/api/v1/reports/export?type=revenue&format=csv')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toMatch(/metric,value/);
  });

  it('revenue export returns a real .xlsx workbook when format=xlsx (answers.md §A)', async () => {
    const { token } = await loginStaff('super_admin');
    const res = await request(app)
      .get('/admin/api/v1/reports/export?type=revenue&format=xlsx')
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((response, callback) => {
        // Collect the binary body as a Buffer (supertest parses as text by default).
        const chunks = [];
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="revenue\.xlsx"/);
    // OOXML files start with the PK zip magic bytes.
    const buf = Buffer.isBuffer(res.body) ? res.body : Buffer.from(res.body);
    expect(buf[0]).toBe(0x50); // 'P'
    expect(buf[1]).toBe(0x4b); // 'K'
    expect(buf.length).toBeGreaterThan(1000); // a real workbook is at least 1KB
  });

  it('system health returns DB + Redis + auditLog status (answers.md §I)', async () => {
    const { token } = await loginStaff('super_admin');
    const res = await request(app)
      .get('/admin/api/v1/system/health')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('mysql');
    expect(res.body.data).toHaveProperty('redis');
    expect(res.body.data).toHaveProperty('auditLog');
    expect(res.body.data.auditLog).toBe('ok');
  });

  it('system health returns DB + Redis status (legacy assertion)', async () => {
    const { token } = await loginStaff('super_admin');
    const res = await request(app)
      .get('/admin/api/v1/system/health')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('mysql');
    expect(res.body.data).toHaveProperty('redis');
  });
});
