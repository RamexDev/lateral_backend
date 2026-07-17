/**
 * Migration: purchases + payments
 * Reveal purchase + payment record. See backend.md §3.2 and §6.7.
 *
 * - purchases.revealed_fields JSON: which contact fields were unlocked
 * - purchases.uq_buyer_target enforces BR-006: never charge the same buyer twice for the same target
 * - payments.telegram_charge_id UNIQUE: idempotency key for FR-PAY-002
 */
exports.up = function (knex) {
  return knex.schema
    .createTable('purchases', (table) => {
      table.bigIncrements('id').unsigned().primary();
      table.bigInteger('buyer_id').unsigned().notNullable();
      table.bigInteger('target_user_id').unsigned().notNullable();
      table.bigInteger('matched_interest_id').unsigned().nullable();
      table.json('revealed_fields').notNullable();
      table.bigInteger('payment_id').unsigned().nullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

      table.foreign('buyer_id').references('users.id').onDelete('RESTRICT');
      table.foreign('target_user_id').references('users.id').onDelete('RESTRICT');
      table.unique(['buyer_id', 'target_user_id'], 'uq_buyer_target');
    })
    .then(() =>
      knex.schema.createTable('payments', (table) => {
        table.bigIncrements('id').unsigned().primary();
        table.bigInteger('purchase_id').unsigned().nullable();
        table.string('telegram_charge_id', 100).nullable().unique();
        table.string('provider', 30).notNullable().defaultTo('telegram_stars');
        table.decimal('amount', 12, 2).notNullable();
        table.string('currency', 10).notNullable();
        table
          .enu('status', ['pending', 'completed', 'failed', 'refunded'])
          .notNullable()
          .defaultTo('pending');
        table.json('raw_payload').nullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

        table.foreign('purchase_id').references('purchases.id').onDelete('SET NULL');
      }),
    )
    .then(() =>
      // Back-fill the purchases.payment_id FK now that payments exists.
      knex.schema.alterTable('purchases', (table) => {
        table.foreign('payment_id').references('payments.id').onDelete('SET NULL');
      }),
    );
};

exports.down = function (knex) {
  return knex.schema
    .alterTable('purchases', (table) => {
      table.dropForeign(['payment_id']);
    })
    .then(() => knex.schema.dropTableIfExists('payments'))
    .then(() => knex.schema.dropTableIfExists('purchases'));
};
