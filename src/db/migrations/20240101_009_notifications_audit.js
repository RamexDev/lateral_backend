/**
 * Migration: notifications + audit_logs
 * See backend.md §3.2 (notifications, audit_logs) and §9 (notification system).
 */
exports.up = function (knex) {
  return knex.schema
    .createTable('notifications', (table) => {
      table.bigIncrements('id').unsigned().primary();
      table.bigInteger('user_id').unsigned().notNullable();
      table
        .enu('type', ['registration', 'digest', 'payment_confirmation', 'broadcast'])
        .notNullable();
      table.enu('channel', ['telegram', 'email', 'sms']).notNullable().defaultTo('telegram');
      table.json('payload').notNullable();
      table.enu('status', ['queued', 'sent', 'failed']).notNullable().defaultTo('queued');
      table.timestamp('sent_at').nullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      table.index(['user_id', 'created_at'], 'idx_notif_user');
    })
    .then(() =>
      knex.schema.createTable('audit_logs', (table) => {
        table.bigIncrements('id').unsigned().primary();
        table.enu('actor_type', ['user', 'staff', 'system']).notNullable();
        table.bigInteger('actor_id').unsigned().nullable();
        table.string('action', 100).notNullable();
        table.string('entity_type', 50).notNullable();
        table.bigInteger('entity_id').unsigned().nullable();
        table.json('metadata').nullable();
        table.string('ip_address', 45).nullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

        table.index(['entity_type', 'entity_id'], 'idx_audit_entity');
        table.index(['actor_type', 'actor_id'], 'idx_audit_actor');
      }),
    );
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('audit_logs')
    .then(() => knex.schema.dropTableIfExists('notifications'));
};
