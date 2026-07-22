// Import MySQL pool.
import { pool } from '../../../db/pool.js';
// Import Redis client.
import { redis } from '../../../lib/redis.js';
// Import API error class.
import { ApiError } from '../../../lib/errors.js';
// Import audit helper.
import { writeAudit } from '../../../lib/audit.js';
// Import bcrypt for staff password hashing.
import { hash } from '@node-rs/bcrypt';

// Mask a phone number for list views: +251911***44
function maskPhone(phone) {
  if (!phone) return null;
  const str = String(phone);
  if (str.length <= 6) return str;
  return str.slice(0, str.length - 4).replace(/.(?=.{4})/g, (c, i) => i >= 4 ? '*' : c);
}

// Better phone masking: keep first 6 chars, mask middle, keep last 2.
function maskPhoneDisplay(phone) {
  if (!phone) return null;
  const str = String(phone);
  if (str.length <= 8) return str.slice(0, 4) + '***';
  return str.slice(0, 6) + '***' + str.slice(-2);
}

// -----------------------------------------------------------------------------
// Dashboard
// -----------------------------------------------------------------------------
export async function getDashboardSummary() {
  const [userRows] = await pool.query(
    'SELECT ' +
    'COUNT(*) AS total_users, ' +
    'SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) AS active_users, ' +
    'SUM(CASE WHEN profile_completed_at IS NOT NULL THEN 1 ELSE 0 END) AS complete_users ' +
    'FROM users'
  );
  const [interestRows] = await pool.query('SELECT COUNT(*) AS total_interests FROM transfer_interests');
  const [purchaseRows] = await pool.query(
    'SELECT COUNT(*) AS total_purchases, COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) AS completed_purchases FROM purchases',
    ['completed']
  );
  const [revenueRows] = await pool.query(
    'SELECT COALESCE(SUM(amount), 0) AS revenue_etb FROM payments WHERE status = ?',
    ['completed']
  );

  return {
    total_users: Number(userRows[0].total_users),
    active_users: Number(userRows[0].active_users),
    complete_users: Number(userRows[0].complete_users),
    total_interests: Number(interestRows[0].total_interests),
    total_purchases: Number(purchaseRows[0].total_purchases),
    completed_purchases: Number(purchaseRows[0].completed_purchases),
    revenue_etb: Number(revenueRows[0].revenue_etb)
  };
}

// -----------------------------------------------------------------------------
// User monitoring
// -----------------------------------------------------------------------------
export async function listUsers(query) {
  const page = Number(query.page) || 1;
  const pageSize = Math.min(Number(query.page_size) || 25, 100);
  const offset = (page - 1) * pageSize;

  const where = [];
  const params = [];

  if (query.q) {
    const like = '%' + query.q + '%';
    where.push('(u.telegram_username LIKE ? OR u.phone_number LIKE ? OR u.full_name_en LIKE ? OR u.full_name_am LIKE ? OR u.branch_name_en LIKE ?)');
    params.push(like, like, like, like, like);
  }
  if (query.bank_id !== undefined) {
    where.push('u.bank_id = ?');
    params.push(query.bank_id);
  }
  if (query.region_id !== undefined) {
    where.push('u.region_id = ?');
    params.push(query.region_id);
  }
  if (query.zone_id !== undefined) {
    where.push('u.zone_id = ?');
    params.push(query.zone_id);
  }
  if (query.grade_id !== undefined) {
    where.push('u.grade_id = ?');
    params.push(query.grade_id);
  }
  if (query.is_active !== undefined) {
    where.push('u.is_active = ?');
    params.push(query.is_active);
  }
  if (query.profile_complete !== undefined) {
    if (query.profile_complete) {
      where.push('u.profile_completed_at IS NOT NULL');
    } else {
      where.push('u.profile_completed_at IS NULL');
    }
  }

  const whereSql = where.length > 0 ? ' WHERE ' + where.join(' AND ') : '';

  const [rows] = await pool.query(
    'SELECT u.id, u.telegram_username, u.phone_number, u.bank_id, u.region_id, u.zone_id, u.grade_id, ' +
    'u.is_active, u.profile_completed_at, u.created_at, ' +
    'b.name_en AS bank_name, r.name_en AS region_name, z.name_en AS zone_name ' +
    'FROM users u ' +
    'JOIN banks b ON b.id = u.bank_id ' +
    'JOIN regions r ON r.id = u.region_id ' +
    'JOIN zones z ON z.id = u.zone_id ' +
    whereSql + ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?',
    [...params, pageSize, offset]
  );

  const [countRows] = await pool.query(
    'SELECT COUNT(*) AS total FROM users u ' + whereSql,
    params
  );

  const results = rows.map((row) => ({
    id: row.id,
    telegram_username: row.telegram_username,
    phone_number: maskPhoneDisplay(row.phone_number),
    bank_id: row.bank_id,
    bank_name: row.bank_name,
    region_id: row.region_id,
    region_name: row.region_name,
    zone_id: row.zone_id,
    zone_name: row.zone_name,
    grade_id: row.grade_id,
    is_active: Boolean(row.is_active),
    profile_complete: Boolean(row.profile_completed_at),
    created_at: row.created_at
  }));

  return {
    results,
    page,
    page_size: pageSize,
    total_results: Number(countRows[0].total)
  };
}

export async function getUserDetail(userId) {
  const [rows] = await pool.query(
    'SELECT u.id, u.telegram_id, u.telegram_username, u.phone_number, ' +
    'u.full_name_en, u.full_name_am, u.branch_name_en, u.branch_name_am, ' +
    'u.neighborhood_en, u.neighborhood_am, u.photo_url, u.photo_source, ' +
    'u.preferred_language, u.is_active, u.profile_completed_at, u.created_at, u.last_activity_at, ' +
    'b.name_en AS bank_name, b.name_am AS bank_name_am, ' +
    'r.name_en AS region_name, r.name_am AS region_name_am, ' +
    'z.name_en AS zone_name, z.name_am AS zone_name_am, ' +
    'g.grade_number, g.band_number, g.band_label_en ' +
    'FROM users u ' +
    'JOIN banks b ON b.id = u.bank_id ' +
    'JOIN regions r ON r.id = u.region_id ' +
    'JOIN zones z ON z.id = u.zone_id ' +
    'LEFT JOIN grades g ON g.id = u.grade_id ' +
    'WHERE u.id = ?',
    [userId]
  );

  if (!rows[0]) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found.');
  }

  const user = rows[0];

  // Get user stats.
  const [interestRows] = await pool.query('SELECT COUNT(*) AS count FROM transfer_interests WHERE user_id = ?', [userId]);
  const [purchaseMadeRows] = await pool.query('SELECT COUNT(*) AS count FROM purchases WHERE buyer_id = ? AND status = ?', [userId, 'completed']);
  const [purchaseOfMeRows] = await pool.query('SELECT COUNT(*) AS count FROM purchases WHERE target_user_id = ? AND status = ?', [userId, 'completed']);
  const [spentRows] = await pool.query(
    'SELECT COALESCE(SUM(p.amount), 0) AS total FROM payments p JOIN purchases pur ON pur.payment_id = p.id WHERE pur.buyer_id = ? AND p.status = ?',
    [userId, 'completed']
  );

  return {
    id: user.id,
    profile: {
      telegram_id: user.telegram_id,
      telegram_username: user.telegram_username,
      phone_number: user.phone_number,
      full_name_en: user.full_name_en,
      full_name_am: user.full_name_am,
      bank_name: user.bank_name,
      bank_name_am: user.bank_name_am,
      region_name: user.region_name,
      region_name_am: user.region_name_am,
      zone_name: user.zone_name,
      zone_name_am: user.zone_name_am,
      branch_name_en: user.branch_name_en,
      branch_name_am: user.branch_name_am,
      neighborhood_en: user.neighborhood_en,
      neighborhood_am: user.neighborhood_am,
      grade_label: user.grade_number ? 'Grade ' + user.grade_number + ' — ' + (user.band_label_en || 'Band ' + user.band_number) : null,
      photo_url: user.photo_url,
      photo_source: user.photo_source,
      preferred_language: user.preferred_language,
      is_active: Boolean(user.is_active),
      profile_complete: Boolean(user.profile_completed_at),
      created_at: user.created_at,
      last_activity_at: user.last_activity_at
    },
    stats: {
      interests_count: Number(interestRows[0].count),
      purchases_made_count: Number(purchaseMadeRows[0].count),
      purchases_of_me_count: Number(purchaseOfMeRows[0].count),
      total_spent_etb: Number(spentRows[0].total)
    }
  };
}

export async function updateUserStatus(userId, { is_active, reason }, staff) {
  // Verify user exists.
  const [rows] = await pool.query('SELECT id, is_active FROM users WHERE id = ?', [userId]);
  if (!rows[0]) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found.');
  }

  // Update status.
  await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [is_active, userId]);

  // Audit the action.
  await writeAudit({
    actorType: 'staff',
    actorId: staff.id,
    action: is_active ? 'admin_user_activate' : 'admin_user_deactivate',
    entityType: 'user',
    entityId: userId,
    metadata: { reason: reason || null }
  });

  return { user_id: userId, is_active };
}

// -----------------------------------------------------------------------------
// Staff management (super_admin only)
// -----------------------------------------------------------------------------
export async function listStaff(query) {
  const page = Number(query.page) || 1;
  const pageSize = Math.min(Number(query.page_size) || 50, 100);
  const offset = (page - 1) * pageSize;

  const [rows] = await pool.query(
    'SELECT id, full_name, email, role, preferred_language, is_active, created_at, last_login_at ' +
    'FROM staff ORDER BY id ASC LIMIT ? OFFSET ?',
    [pageSize, offset]
  );

  const [countRows] = await pool.query('SELECT COUNT(*) AS total FROM staff');

  return {
    results: rows.map((row) => ({
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      role: row.role,
      preferred_language: row.preferred_language,
      is_active: Boolean(row.is_active),
      created_at: row.created_at,
      last_login_at: row.last_login_at
    })),
    page,
    page_size: pageSize,
    total_results: Number(countRows[0].total)
  };
}

export async function createStaff(input, actor) {
  // Hash password.
  const passwordHash = await hash(input.password, 10);

  try {
    const [result] = await pool.query(
      'INSERT INTO staff (full_name, email, password_hash, role, preferred_language, is_active) VALUES (?, ?, ?, ?, ?, TRUE)',
      [input.full_name, input.email.toLowerCase(), passwordHash, input.role, input.preferred_language]
    );

    await writeAudit({
      actorType: 'staff',
      actorId: actor.id,
      action: 'admin_staff_create',
      entityType: 'staff',
      entityId: result.insertId,
      metadata: { email: input.email, role: input.role }
    });

    return { id: result.insertId };
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'DUPLICATE_ENTRY', 'Staff email already exists.');
    }
    throw err;
  }
}

export async function updateStaff(staffId, input, actor) {
  // Verify staff exists.
  const [rows] = await pool.query('SELECT id FROM staff WHERE id = ?', [staffId]);
  if (!rows[0]) {
    throw new ApiError(404, 'NOT_FOUND', 'Staff not found.');
  }

  const sets = [];
  const params = [];

  if (input.full_name !== undefined) {
    sets.push('full_name = ?');
    params.push(input.full_name);
  }
  if (input.role !== undefined) {
    sets.push('role = ?');
    params.push(input.role);
  }
  if (input.preferred_language !== undefined) {
    sets.push('preferred_language = ?');
    params.push(input.preferred_language);
  }
  if (input.is_active !== undefined) {
    sets.push('is_active = ?');
    params.push(input.is_active);
  }

  if (sets.length > 0) {
    params.push(staffId);
    await pool.query('UPDATE staff SET ' + sets.join(', ') + ' WHERE id = ?', params);
  }

  await writeAudit({
    actorType: 'staff',
    actorId: actor.id,
    action: 'admin_staff_update',
    entityType: 'staff',
    entityId: staffId,
    metadata: { changes: Object.keys(input).filter((k) => input[k] !== undefined) }
  });

  return { id: staffId, updated: true };
}

// -----------------------------------------------------------------------------
// Reports
// -----------------------------------------------------------------------------
export async function getRevenueReport(query) {
  const where = ['p.status = ?'];
  const params = ['completed'];

  if (query.from) {
    where.push('p.created_at >= ?');
    params.push(query.from + ' 00:00:00');
  }
  if (query.to) {
    where.push('p.created_at <= ?');
    params.push(query.to + ' 23:59:59');
  }

  const whereSql = ' WHERE ' + where.join(' AND ');

  // Total revenue.
  const [totalRows] = await pool.query(
    'SELECT COALESCE(SUM(p.amount), 0) AS revenue_etb, COUNT(*) AS purchase_count FROM payments p' + whereSql,
    params
  );

  // Per-bank breakdown.
  const [bankRows] = await pool.query(
    'SELECT b.id AS bank_id, b.name_en AS bank_name, ' +
    'COALESCE(SUM(p.amount), 0) AS revenue_etb, COUNT(*) AS purchase_count ' +
    'FROM payments p ' +
    'JOIN purchases pur ON pur.payment_id = p.id ' +
    'JOIN users u ON u.id = pur.buyer_id ' +
    'JOIN banks b ON b.id = u.bank_id ' +
    whereSql + ' GROUP BY b.id, b.name_en ORDER BY revenue_etb DESC',
    params
  );

  return {
    revenue_etb: Number(totalRows[0].revenue_etb),
    purchase_count: Number(totalRows[0].purchase_count),
    by_bank: bankRows.map((row) => ({
      bank_id: row.bank_id,
      bank_name: row.bank_name,
      revenue_etb: Number(row.revenue_etb),
      purchase_count: Number(row.purchase_count)
    }))
  };
}

export async function getUserReport(query) {
  const where = [];
  const params = [];

  if (query.from) {
    where.push('u.created_at >= ?');
    params.push(query.from + ' 00:00:00');
  }
  if (query.to) {
    where.push('u.created_at <= ?');
    params.push(query.to + ' 23:59:59');
  }

  const whereSql = where.length > 0 ? ' WHERE ' + where.join(' AND ') : '';

  // Overall stats.
  const [totalRows] = await pool.query(
    'SELECT COUNT(*) AS new_users, ' +
    'SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) AS active_users, ' +
    'SUM(CASE WHEN profile_completed_at IS NOT NULL THEN 1 ELSE 0 END) AS complete_users ' +
    'FROM users u' + whereSql,
    params
  );

  // Per-bank breakdown.
  const [bankRows] = await pool.query(
    'SELECT b.id AS bank_id, b.name_en AS bank_name, ' +
    'COUNT(*) AS new_users, ' +
    'SUM(CASE WHEN u.is_active = TRUE THEN 1 ELSE 0 END) AS active_users ' +
    'FROM users u JOIN banks b ON b.id = u.bank_id' + whereSql + ' GROUP BY b.id, b.name_en ORDER BY new_users DESC',
    params
  );

  return {
    new_users: Number(totalRows[0].new_users),
    active_users: Number(totalRows[0].active_users),
    complete_users: Number(totalRows[0].complete_users),
    by_bank: bankRows.map((row) => ({
      bank_id: row.bank_id,
      bank_name: row.bank_name,
      new_users: Number(row.new_users),
      active_users: Number(row.active_users)
    }))
  };
}

export async function getInterestReport(query) {
  const where = [];
  const params = [];

  if (query.from) {
    where.push('ti.created_at >= ?');
    params.push(query.from + ' 00:00:00');
  }
  if (query.to) {
    where.push('ti.created_at <= ?');
    params.push(query.to + ' 23:59:59');
  }

  const whereSql = where.length > 0 ? ' WHERE ' + where.join(' AND ') : '';

  // Total interests.
  const [totalRows] = await pool.query('SELECT COUNT(*) AS total_interests FROM transfer_interests ti' + whereSql, params);

  // Per-region breakdown.
  const [regionRows] = await pool.query(
    'SELECT r.id AS region_id, r.name_en AS region_name, COUNT(*) AS interest_count ' +
    'FROM transfer_interests ti JOIN regions r ON r.id = ti.region_id' + whereSql + ' GROUP BY r.id, r.name_en ORDER BY interest_count DESC',
    params
  );

  return {
    total_interests: Number(totalRows[0].total_interests),
    by_region: regionRows.map((row) => ({
      region_id: row.region_id,
      region_name: row.region_name,
      interest_count: Number(row.interest_count)
    }))
  };
}

// -----------------------------------------------------------------------------
// System health
// -----------------------------------------------------------------------------
export async function getSystemHealth() {
  const health = {
    mysql: 'unknown',
    redis: 'unknown',
    audit_log: 'unknown',
    active_staff_sessions: 0,
    queued_notifications: 0
  };

  // Check MySQL.
  try {
    await pool.query('SELECT 1');
    health.mysql = 'ok';
  } catch {
    health.mysql = 'error';
  }

  // Check Redis.
  try {
    await redis.ping();
    health.redis = 'ok';
  } catch {
    health.redis = 'error';
  }

  // Check audit log.
  try {
    await pool.query('SELECT 1 FROM audit_logs LIMIT 1');
    health.audit_log = 'ok';
  } catch {
    health.audit_log = 'error';
  }

  // Count active staff sessions.
  try {
    const [sessionRows] = await pool.query('SELECT COUNT(*) AS count FROM staff_refresh_tokens WHERE revoked_at IS NULL AND expires_at > NOW()');
    health.active_staff_sessions = Number(sessionRows[0].count);
  } catch {
    health.active_staff_sessions = 0;
  }

  // Count unsent notifications.
  try {
    const [notifRows] = await pool.query('SELECT COUNT(*) AS count FROM notifications WHERE sent_at IS NULL');
    health.queued_notifications = Number(notifRows[0].count);
  } catch {
    health.queued_notifications = 0;
  }

  return health;
}
