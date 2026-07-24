-- =============================================================================
-- Zwuwur backend migration 004
-- Add shortlist table for save-for-later functionality.
-- One row per (buyer, candidate) pair — buyer saved the candidate without paying.
-- =============================================================================

CREATE TABLE IF NOT EXISTS shortlist (
  -- Primary key.
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- The user who shortlisted the candidate.
  user_id BIGINT UNSIGNED NOT NULL,

  -- The shortlisted candidate.
  target_user_id BIGINT UNSIGNED NOT NULL,

  -- Creation timestamp.
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Foreign keys.
  CONSTRAINT fk_sl_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_sl_target
    FOREIGN KEY (target_user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  -- One shortlist entry per user/target pair.
  CONSTRAINT uq_sl_user_target UNIQUE (user_id, target_user_id),

  -- Lookups.
  INDEX idx_sl_user (user_id),
  INDEX idx_sl_user_created (user_id, created_at),
  INDEX idx_sl_target (target_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
