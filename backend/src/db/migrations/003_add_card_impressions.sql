-- =============================================================================
-- Zwuwur backend migration 003
-- Add card_impressions table for tracking which cards the viewer has seen.
-- Also add is_shortlisted to support the shortlist feature (migration 004
-- would normally add the shortlist table, but we add the flag column here
-- to keep the card serializer changes in one migration).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Card impressions
-- One row per (viewer, candidate) pair — first time the viewer sees the card.
-- Updated on each subsequent impression for analytics.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS card_impressions (
  -- Primary key.
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- The viewer who saw the card.
  viewer_id BIGINT UNSIGNED NOT NULL,

  -- The candidate whose card was seen.
  candidate_id BIGINT UNSIGNED NOT NULL,

  -- First impression timestamp.
  first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Last impression timestamp.
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Total impression count.
  view_count INT UNSIGNED NOT NULL DEFAULT 1,

  -- Foreign keys.
  CONSTRAINT fk_ci_viewer
    FOREIGN KEY (viewer_id)
    REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_ci_candidate
    FOREIGN KEY (candidate_id)
    REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  -- One row per viewer/candidate pair.
  CONSTRAINT uq_ci_viewer_candidate UNIQUE (viewer_id, candidate_id),

  -- Lookups.
  INDEX idx_ci_viewer (viewer_id),
  INDEX idx_ci_candidate (candidate_id),
  INDEX idx_ci_viewer_last_seen (viewer_id, last_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
