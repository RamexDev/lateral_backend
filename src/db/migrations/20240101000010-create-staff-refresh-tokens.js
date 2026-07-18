/**
 * Migration: staff_refresh_tokens
 *
 * Backing storage for the 7-day refresh token issued alongside the 30-minute
 * staff access token (SEC-009, answers.md §D). Storing the refresh token in
 * MySQL (rather than as a stateless JWT) lets us revoke it on logout, password
 * change, or staff deactivation (FR-ADM-003).
 *
 * The token is stored as a SHA-256 hash, never plaintext — same pattern as
 * bcrypt for passwords, just SHA-256 because refresh tokens are random
 * high-entropy strings (no need for the slow bcrypt KDF).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('staff_refresh_tokens', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      staff_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'staff', key: 'id' },
        onDelete: 'CASCADE',
      },
      // SHA-256 hash of the raw refresh token. The raw token is only ever
      // returned to the client at issue time; the DB only sees the hash.
      token_hash: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      // NULL = active; non-NULL = revoked (set on logout, password change,
      // staff deactivation, or rotation). A revoked token can no longer be
      // used to mint a new access token.
      revoked_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('staff_refresh_tokens', {
      fields: ['staff_id'],
      name: 'idx_staff_refresh_tokens_staff',
    });
    await queryInterface.addIndex('staff_refresh_tokens', {
      fields: ['expires_at'],
      name: 'idx_staff_refresh_tokens_expires',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('staff_refresh_tokens');
  },
};
