/**
 * Test-only DB helper — exposes the Sequelize models through a Knex-like `db('table')`
 * builder API so existing test code that does `db('users').where(...).first()` keeps
 * working after the ORM migration.
 *
 * This is intentionally minimal — only the query shapes the tests actually use are
 * supported:
 *   - db('table').select(...cols).where(...conds).first() / .orderBy(...)
 *   - db('table').where(...conds).first()
 *   - db('table').where(...conds).update(patch)
 *   - db('table').insert(row)
 *   - db('table').first()
 *   - db('table').count('* as count').first()
 *
 * For anything more complex, tests should use the model directly.
 */
const sequelize = require('../src/db/sequelize');
const { QueryTypes } = require('sequelize');

// Map table name → Sequelize model. Loaded lazily to avoid circular imports during setup.
let _models = null;
function models() {
  if (!_models) _models = require('../src/db/models');
  return _models;
}

const TABLE_TO_MODEL = {
  banks: 'Bank',
  locations: 'Location',
  location_ancestors: 'LocationAncestor',
  grades: 'Grade',
  users: 'User',
  transfer_interests: 'TransferInterest',
  purchases: 'Purchase',
  payments: 'Payment',
  notifications: 'Notification',
  roles: 'Role',
  staff: 'Staff',
  audit_logs: 'AuditLog',
};

class TestQueryBuilder {
  constructor(tableName) {
    this.tableName = tableName;
    this._select = null;
    this._where = null;
    this._orderBy = null;
    this._limit = null;
  }

  select(...cols) {
    if (cols.length === 1 && typeof cols[0] === 'string' && cols[0].includes(',')) {
      this._select = cols[0].split(',').map((s) => s.trim());
    } else if (cols.length === 1 && Array.isArray(cols[0])) {
      this._select = cols[0];
    } else {
      this._select = cols;
    }
    return this;
  }

  where(...args) {
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
      this._where = args[0];
    } else if (args.length === 2) {
      this._where = { [args[0]]: args[1] };
    }
    return this;
  }

  andWhere(...args) {
    const next = { ...(this._where || {}) };
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
      Object.assign(next, args[0]);
    } else if (args.length === 2) {
      next[args[0]] = args[1];
    }
    this._where = next;
    return this;
  }

  orderBy(column, direction = 'asc') {
    this._orderBy = [column, direction.toUpperCase()];
    return this;
  }

  count(expr) {
    // Knex: db('t').count('* as count').first() → { count: N }
    this._count = true;
    return this;
  }

  async first() {
    const rows = await this._execute(1);
    return rows[0] || null;
  }

  async then(resolve, reject) {
    // Make the builder thenable — calling await resolves to the rows array.
    try {
      const rows = await this._execute();
      resolve(rows);
    } catch (err) {
      reject(err);
    }
  }

  _execute(limit) {
    const cols = this._select || ['*'];
    const selectSql = cols.map((c) => (c === '*' ? '*' : c)).join(', ');

    const whereParts = [];
    const replacements = {};
    if (this._where) {
      for (const [k, v] of Object.entries(this._where)) {
        const placeholder = `w_${k}`;
        whereParts.push(`${k} = :${placeholder}`);
        replacements[placeholder] = v;
      }
    }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    let sql;
    if (this._count) {
      sql = `SELECT COUNT(*) AS count FROM ${this.tableName} ${whereSql}`;
    } else {
      const limitSql = limit !== undefined ? `LIMIT ${limit}` : '';
      const orderSql = this._orderBy ? `ORDER BY ${this._orderBy[0]} ${this._orderBy[1]}` : '';
      sql = `SELECT ${selectSql} FROM ${this.tableName} ${whereSql} ${orderSql} ${limitSql}`.trim();
    }

    return sequelize.query(sql, {
      replacements,
      type: QueryTypes.SELECT,
    });
  }
}

const db = (tableName) => new TestQueryBuilder(tableName);

// Expose sequelize for raw queries in tests.
db.sequelize = sequelize;

// Also expose a Knex-like `db.destroy()` for the afterAll hook.
db.destroy = async () => {
  await sequelize.close().catch(() => {
    /* ignore */
  });
};

// Expose a `db('table').insert(row)` and `db('table').where(...).update(patch)` shortcut.
// Patch the prototype to add insert + update + del.
TestQueryBuilder.prototype.insert = async function (row) {
  const modelName = TABLE_TO_MODEL[this.tableName];
  if (!modelName) throw new Error(`Unknown table: ${this.tableName}`);
  const Model = models()[modelName];
  const instance = await Model.create(row);
  return [instance.id];
};

TestQueryBuilder.prototype.update = async function (patch) {
  const modelName = TABLE_TO_MODEL[this.tableName];
  if (!modelName) throw new Error(`Unknown table: ${this.tableName}`);
  const Model = models()[modelName];
  const where = this._where || {};
  const [affected] = await Model.update(patch, { where });
  return affected;
};

TestQueryBuilder.prototype.del = async function () {
  const modelName = TABLE_TO_MODEL[this.tableName];
  if (!modelName) throw new Error(`Unknown table: ${this.tableName}`);
  const Model = models()[modelName];
  const where = this._where || {};
  return Model.destroy({ where });
};

module.exports = db;
