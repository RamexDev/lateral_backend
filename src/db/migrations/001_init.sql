-- =============================================================================
-- Zwuwur backend initial schema
-- MySQL 8 / MariaDB compatible
-- Charset: utf8mb4
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- -----------------------------------------------------------------------------
-- Migration tracking table
-- The migration runner also creates this table, but defining it here is safe.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
  -- Migration file name.
  name VARCHAR(191) PRIMARY KEY,

  -- Timestamp when migration was applied.
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Banks
-- Reference data seeded by admin.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS banks (
  -- Primary key.
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- Official English bank name.
  name_en VARCHAR(191) NOT NULL,

  -- Official Amharic bank name.
  name_am VARCHAR(191) NOT NULL,

  -- English alias or nickname.
  alias_en VARCHAR(90) NOT NULL,

  -- Amharic alias or nickname.
  alias_am VARCHAR(90) NOT NULL,

  -- Optional SWIFT/BIC code.
  swift_code VARCHAR(12) NULL,

  -- Numeric establishment or licensing year.
  year_established SMALLINT UNSIGNED NULL,

  -- Optional note for ambiguous establishment years.
  year_established_note VARCHAR(191) NULL,

  -- Soft active flag.
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Creation timestamp.
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Update timestamp.
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Bank names should be unique.
  CONSTRAINT uq_banks_name_en UNIQUE (name_en),
  CONSTRAINT uq_banks_name_am UNIQUE (name_am),

  -- Aliases must be unique.
  CONSTRAINT uq_banks_alias_en UNIQUE (alias_en),
  CONSTRAINT uq_banks_alias_am UNIQUE (alias_am),

  -- SWIFT code should be unique when present.
  -- Multiple NULL values are allowed by SQL unique constraints.
  CONSTRAINT uq_banks_swift_code UNIQUE (swift_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Regions / chartered cities
-- Flat geography model: regions are top-level nodes.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS regions (
  -- Primary key.
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- English region name.
  name_en VARCHAR(150) NOT NULL,

  -- Amharic region name.
  name_am VARCHAR(150) NOT NULL,

  -- Region type.
  type ENUM('region', 'chartered_city') NOT NULL DEFAULT 'region',

  -- Soft active flag.
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Creation timestamp.
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Update timestamp.
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Region names should be unique.
  CONSTRAINT uq_regions_name_en UNIQUE (name_en),
  CONSTRAINT uq_regions_name_am UNIQUE (name_am)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Zones / subcities / special woredas
-- Flat geography model: zones reference parent region directly.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS zones (
  -- Primary key.
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- Parent region.
  region_id INT UNSIGNED NOT NULL,

  -- English zone name.
  name_en VARCHAR(150) NOT NULL,

  -- Amharic zone name.
  name_am VARCHAR(150) NOT NULL,

  -- Optional administrative note.
  note VARCHAR(255) NULL,

  -- Soft active flag.
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Creation timestamp.
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Update timestamp.
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Zone names must be unique inside a region.
  CONSTRAINT uq_zones_region_name_en UNIQUE (region_id, name_en),
  CONSTRAINT uq_zones_region_name_am UNIQUE (region_id, name_am),

  -- Foreign key to parent region.
  CONSTRAINT fk_zones_region
    FOREIGN KEY (region_id)
    REFERENCES regions(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  -- Lookup zones by region.
  INDEX idx_zones_region (region_id),

  -- Lookup active zones by region.
  INDEX idx_zones_region_active (region_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Grades
-- 18 grades grouped into 6 bands of 3.
-- band_number must equal CEIL(grade_number / 3).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grades (
  -- Primary key.
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- Grade number, e.g. 1..18.
  grade_number TINYINT UNSIGNED NOT NULL,

  -- Band number, e.g. 1..6.
  band_number TINYINT UNSIGNED NOT NULL,

  -- English band label.
  band_label_en VARCHAR(80) NOT NULL,

  -- Amharic band label.
  band_label_am VARCHAR(80) NOT NULL,

  -- English tier classification.
  tier_classification_en VARCHAR(80) NOT NULL,

  -- Amharic tier classification.
  tier_classification_am VARCHAR(80) NOT NULL,

  -- Ranking order.
  rank_order TINYINT UNSIGNED NOT NULL,

  -- Soft active flag.
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Creation timestamp.
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Update timestamp.
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Grade number must be unique.
  CONSTRAINT uq_grades_grade_number UNIQUE (grade_number),

  -- Rank order should be unique.
  CONSTRAINT uq_grades_rank_order UNIQUE (rank_order),

  -- Enforce band formula.
  CONSTRAINT chk_grades_band_formula CHECK (band_number = CEIL(grade_number / 3))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Users
-- Bot onboarding creates incomplete users.
-- Therefore the old bilingual NOT NULL CHECK constraints are intentionally removed.
-- Profile completion is enforced in the application layer.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  -- Primary key.
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- Telegram user ID.
  telegram_id BIGINT UNSIGNED NOT NULL,

  -- Optional Telegram username.
  telegram_username VARCHAR(64) NULL,

  -- Phone number from Telegram contact share or OTP fallback.
  phone_number VARCHAR(20) NOT NULL,

  -- Bank fixed at registration.
  bank_id INT UNSIGNED NOT NULL,

  -- Current region.
  region_id INT UNSIGNED NOT NULL,

  -- Current zone.
  zone_id INT UNSIGNED NOT NULL,

  -- Optional grade, completed in Mini App.
  grade_id INT UNSIGNED NULL,

  -- Bilingual full name.
  -- At least one language version is required for profile completion.
  full_name_en VARCHAR(150) NULL,
  full_name_am VARCHAR(150) NULL,

  -- Bilingual branch name.
  -- At least one language version is required for profile completion.
  branch_name_en VARCHAR(150) NULL,
  branch_name_am VARCHAR(150) NULL,

  -- Bilingual neighborhood.
  -- At least one language version is required for profile completion.
  neighborhood_en VARCHAR(150) NULL,
  neighborhood_am VARCHAR(150) NULL,

  -- Current effective photo URL/path.
  photo_url VARCHAR(500) NULL,

  -- Last fetched Telegram photo URL/path.
  -- Used when a custom photo is removed.
  telegram_photo_url VARCHAR(500) NULL,

  -- Telegram photo file id, useful for re-fetching/downloading.
  telegram_photo_file_id VARCHAR(255) NULL,

  -- Custom uploaded photo URL/path.
  custom_photo_url VARCHAR(500) NULL,

  -- Source of the current photo.
  photo_source ENUM('telegram', 'custom', 'placeholder') NOT NULL DEFAULT 'placeholder',

  -- Preferred language.
  preferred_language ENUM('en', 'am') NOT NULL DEFAULT 'en',

  -- Soft active flag.
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Reason for admin deactivation, if deactivated.
  deactivated_reason VARCHAR(191) NULL,

  -- Timestamp when admin deactivated the user.
  deactivated_at DATETIME NULL,

  -- Timestamp when profile became complete.
  profile_completed_at DATETIME NULL,

  -- Timestamp when the one-time profile completion reminder was sent.
  profile_reminder_sent_at DATETIME NULL,

  -- Timestamp of last digest sent to this user.
  last_digest_at DATETIME NULL,

  -- Timestamp of last activity.
  last_activity_at DATETIME NULL,

  -- Creation timestamp.
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Update timestamp.
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Telegram ID must be unique.
  CONSTRAINT uq_users_telegram_id UNIQUE (telegram_id),

  -- One phone number may only belong to one account per bank.
  CONSTRAINT uq_users_phone_bank UNIQUE (phone_number, bank_id),

  -- Foreign keys.
  CONSTRAINT fk_users_bank
    FOREIGN KEY (bank_id)
    REFERENCES banks(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_users_region
    FOREIGN KEY (region_id)
    REFERENCES regions(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_users_zone
    FOREIGN KEY (zone_id)
    REFERENCES zones(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_users_grade
    FOREIGN KEY (grade_id)
    REFERENCES grades(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  -- Basic sanity checks.
  CONSTRAINT chk_users_telegram_id_positive CHECK (telegram_id > 0),
  CONSTRAINT chk_users_phone_not_empty CHECK (CHAR_LENGTH(phone_number) >= 5),

  -- Conditional length rules.
  -- These allow NULL during incomplete bot onboarding,
  -- but enforce minimum length when a language version is provided.
  CONSTRAINT chk_users_full_name_en_min
    CHECK (full_name_en IS NULL OR CHAR_LENGTH(full_name_en) >= 1),

  CONSTRAINT chk_users_full_name_am_min
    CHECK (full_name_am IS NULL OR CHAR_LENGTH(full_name_am) >= 1),

  CONSTRAINT chk_users_branch_name_en_min
    CHECK (branch_name_en IS NULL OR CHAR_LENGTH(branch_name_en) >= 3),

  CONSTRAINT chk_users_branch_name_am_min
    CHECK (branch_name_am IS NULL OR CHAR_LENGTH(branch_name_am) >= 3),

  CONSTRAINT chk_users_neighborhood_en_min
    CHECK (neighborhood_en IS NULL OR CHAR_LENGTH(neighborhood_en) >= 2),

  CONSTRAINT chk_users_neighborhood_am_min
    CHECK (neighborhood_am IS NULL OR CHAR_LENGTH(neighborhood_am) >= 2),

  -- General user lookups.
  INDEX idx_users_phone (phone_number),
  INDEX idx_users_telegram_username (telegram_username),
  INDEX idx_users_grade (grade_id),

  -- Marketplace/feed lookups.
  INDEX idx_users_bank_active_complete (bank_id, is_active, profile_completed_at),
  INDEX idx_users_feed (bank_id, is_active, profile_completed_at, grade_id),
  INDEX idx_users_active_complete (is_active, profile_completed_at),
  INDEX idx_users_profile_completed_at (profile_completed_at),

  -- Geography lookups.
  INDEX idx_users_region (region_id),
  INDEX idx_users_zone (zone_id),
  INDEX idx_users_bank_region_zone (bank_id, region_id, zone_id),

  -- Digest/notification lookups.
  INDEX idx_users_digest (is_active, profile_completed_at, last_digest_at),
  INDEX idx_users_last_activity (last_activity_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Transfer interests
-- zone_id NULL means broad region interest.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transfer_interests (
  -- Primary key.
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- Owner of the interest.
  user_id BIGINT UNSIGNED NOT NULL,

  -- Desired region.
  region_id INT UNSIGNED NOT NULL,

  -- Desired zone.
  -- NULL means broad interest anywhere in the region.
  zone_id INT UNSIGNED NULL,

  -- Interest creation timestamp.
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Foreign keys.
  CONSTRAINT fk_ti_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_ti_region
    FOREIGN KEY (region_id)
    REFERENCES regions(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_ti_zone
    FOREIGN KEY (zone_id)
    REFERENCES zones(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  -- Prevent exact duplicate zone interests.
  -- Note: SQL treats NULL as distinct in unique constraints,
  -- so duplicate broad-region interests must also be prevented in application logic.
  CONSTRAINT uq_ti_user_region_zone UNIQUE (user_id, region_id, zone_id),

  -- User interest lookups.
  INDEX idx_ti_user (user_id),
  INDEX idx_ti_user_zone_region (user_id, zone_id, region_id),

  -- Matching lookups.
  INDEX idx_ti_region_zone (region_id, zone_id),
  INDEX idx_ti_zone_region_user (zone_id, region_id, user_id),

  -- Ranking/recency lookups.
  INDEX idx_ti_region_zone_created (region_id, zone_id, created_at),
  INDEX idx_ti_zone_created (zone_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Purchases
-- One purchase per buyer/target pair.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchases (
  -- Primary key.
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- Buyer user ID.
  buyer_id BIGINT UNSIGNED NOT NULL,

  -- Candidate/target user ID.
  target_user_id BIGINT UNSIGNED NOT NULL,

  -- Latest associated payment ID.
  -- This is intentionally not a foreign key to avoid circular FK complexity.
  payment_id BIGINT UNSIGNED NULL,

  -- Purchase status.
  status ENUM('pending', 'completed') NOT NULL DEFAULT 'pending',

  -- Reveal price snapshot at purchase initiation.
  amount DECIMAL(10,2) NULL,

  -- Currency snapshot.
  currency CHAR(3) NULL,

  -- Snapshot of revealed fields after payment completion.
  revealed_fields JSON NULL,

  -- Creation timestamp.
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Completion timestamp.
  completed_at DATETIME NULL,

  -- Update timestamp.
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Foreign keys.
  CONSTRAINT fk_purchases_buyer
    FOREIGN KEY (buyer_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_purchases_target
    FOREIGN KEY (target_user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  -- A buyer can purchase a target only once.
  CONSTRAINT uq_purchases_buyer_target UNIQUE (buyer_id, target_user_id),

  -- Amount must be positive when present.
  CONSTRAINT chk_purchases_amount_positive CHECK (amount IS NULL OR amount > 0),

  -- Purchase lookups.
  INDEX idx_purchases_buyer (buyer_id),
  INDEX idx_purchases_target (target_user_id),
  INDEX idx_purchases_buyer_status (buyer_id, status),
  INDEX idx_purchases_target_status (target_user_id, status),
  INDEX idx_purchases_completed_at (completed_at),
  INDEX idx_purchases_payment (payment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Payments
-- Provider-agnostic payment attempts and confirmations.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  -- Primary key.
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- Related purchase.
  purchase_id BIGINT UNSIGNED NOT NULL,

  -- Payment provider.
  provider ENUM('chapa', 'telebirr') NOT NULL,

  -- Provider charge/reference ID.
  provider_charge_id VARCHAR(191) NULL,

  -- Internal transaction reference sent to provider.
  tx_ref VARCHAR(191) NOT NULL,

  -- Payment amount.
  amount DECIMAL(10,2) NOT NULL,

  -- Payment currency.
  currency CHAR(3) NOT NULL DEFAULT 'ETB',

  -- Payment status.
  status ENUM('pending', 'completed', 'failed', 'refunded') NOT NULL DEFAULT 'pending',

  -- True when this payment succeeded but the purchase was already completed.
  duplicate_ignored BOOLEAN NOT NULL DEFAULT FALSE,

  -- Raw webhook payload.
  raw_payload JSON NULL,

  -- Creation timestamp.
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Completion timestamp.
  completed_at DATETIME NULL,

  -- Update timestamp.
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Foreign key to purchase.
  CONSTRAINT fk_payments_purchase
    FOREIGN KEY (purchase_id)
    REFERENCES purchases(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  -- Provider charge ID must be unique when present.
  CONSTRAINT uq_payments_provider_charge UNIQUE (provider_charge_id),

  -- Internal transaction reference must be unique.
  CONSTRAINT uq_payments_tx_ref UNIQUE (tx_ref),

  -- Basic sanity checks.
  CONSTRAINT chk_payments_amount_positive CHECK (amount > 0),
  CONSTRAINT chk_payments_tx_ref_not_empty CHECK (CHAR_LENGTH(tx_ref) > 0),

  -- Payment lookups.
  INDEX idx_payments_purchase (purchase_id),
  INDEX idx_payments_status_created (status, created_at),
  INDEX idx_payments_completed_at (completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Staff
-- Admin PWA users.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff (
  -- Primary key.
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- Staff full name.
  full_name VARCHAR(150) NOT NULL,

  -- Login email.
  email VARCHAR(150) NOT NULL,

  -- Bcrypt password hash.
  password_hash VARCHAR(255) NOT NULL,

  -- Staff role.
  role ENUM('super_admin', 'admin') NOT NULL,

  -- Preferred language.
  preferred_language ENUM('en', 'am') NOT NULL DEFAULT 'en',

  -- Soft active flag.
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Last successful login timestamp.
  last_login_at DATETIME NULL,

  -- Creation timestamp.
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Update timestamp.
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Email must be unique.
  CONSTRAINT uq_staff_email UNIQUE (email),

  -- Basic sanity checks.
  CONSTRAINT chk_staff_email_min CHECK (CHAR_LENGTH(email) >= 3),
  CONSTRAINT chk_staff_password_hash_min CHECK (CHAR_LENGTH(password_hash) >= 20)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Broadcasts
-- Metadata for admin broadcast notifications.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS broadcasts (
  -- Primary key.
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- Staff member who created the broadcast.
  staff_id INT UNSIGNED NOT NULL,

  -- Broadcast segment scope.
  scope ENUM('all', 'bank', 'region', 'zone') NOT NULL DEFAULT 'all',

  -- Optional bank segment.
  bank_id INT UNSIGNED NULL,

  -- Optional region segment.
  region_id INT UNSIGNED NULL,

  -- Optional zone segment.
  zone_id INT UNSIGNED NULL,

  -- English broadcast message.
  message_en TEXT NOT NULL,

  -- Amharic broadcast message.
  message_am TEXT NOT NULL,

  -- Number of recipients queued.
  recipient_count INT UNSIGNED NOT NULL DEFAULT 0,

  -- Broadcast processing status.
  status ENUM('queued', 'sending', 'sent', 'failed') NOT NULL DEFAULT 'queued',

  -- Optional error message.
  error VARCHAR(255) NULL,

  -- Timestamp when broadcast finished sending.
  sent_at DATETIME NULL,

  -- Creation timestamp.
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Update timestamp.
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Foreign keys.
  CONSTRAINT fk_broadcasts_staff
    FOREIGN KEY (staff_id)
    REFERENCES staff(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_broadcasts_bank
    FOREIGN KEY (bank_id)
    REFERENCES banks(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT fk_broadcasts_region
    FOREIGN KEY (region_id)
    REFERENCES regions(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT fk_broadcasts_zone
    FOREIGN KEY (zone_id)
    REFERENCES zones(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  -- Broadcast lookups.
  INDEX idx_broadcasts_staff (staff_id),
  INDEX idx_broadcasts_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Notifications
-- Telegram-only notification records.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  -- Primary key.
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- Recipient user.
  user_id BIGINT UNSIGNED NOT NULL,

  -- Optional related broadcast.
  broadcast_id BIGINT UNSIGNED NULL,

  -- Notification type.
  type ENUM('digest', 'broadcast', 'payment_confirmation', 'profile_nudge') NOT NULL,

  -- Notification payload.
  payload JSON NULL,

  -- Delivery status.
  status ENUM('queued', 'sent', 'failed') NOT NULL DEFAULT 'queued',

  -- Optional Telegram/provider message ID.
  provider_message_id VARCHAR(191) NULL,

  -- Optional delivery error.
  error VARCHAR(255) NULL,

  -- Timestamp when notification was sent.
  sent_at DATETIME NULL,

  -- Creation timestamp.
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Update timestamp.
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Foreign keys.
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_notifications_broadcast
    FOREIGN KEY (broadcast_id)
    REFERENCES broadcasts(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  -- Notification lookups.
  INDEX idx_notifications_user (user_id),
  INDEX idx_notifications_user_created (user_id, created_at),
  INDEX idx_notifications_status_created (status, created_at),
  INDEX idx_notifications_broadcast (broadcast_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Staff refresh tokens
-- Rotating opaque refresh tokens stored as SHA-256 hashes.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_refresh_tokens (
  -- Primary key.
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- Staff account.
  staff_id INT UNSIGNED NOT NULL,

  -- SHA-256 hex hash of opaque refresh token.
  token_hash CHAR(64) NOT NULL,

  -- Expiry timestamp.
  expires_at DATETIME NOT NULL,

  -- Revocation timestamp.
  revoked_at DATETIME NULL,

  -- Creation timestamp.
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Update timestamp.
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Foreign key.
  CONSTRAINT fk_srt_staff
    FOREIGN KEY (staff_id)
    REFERENCES staff(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  -- Token hash must be unique.
  CONSTRAINT uq_srt_token_hash UNIQUE (token_hash),

  -- Token hash must be SHA-256 hex length.
  CONSTRAINT chk_srt_token_hash_length CHECK (CHAR_LENGTH(token_hash) = 64),

  -- Token lookups.
  INDEX idx_srt_staff (staff_id),
  INDEX idx_srt_staff_active (staff_id, revoked_at, expires_at),
  INDEX idx_srt_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Audit logs
-- Polymorphic audit trail.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  -- Primary key.
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- Actor type.
  actor_type ENUM('staff', 'user', 'system') NOT NULL,

  -- Actor ID when known.
  actor_id BIGINT UNSIGNED NULL,

  -- Audit action name.
  action VARCHAR(100) NOT NULL,

  -- Entity type being acted on.
  entity_type VARCHAR(100) NULL,

  -- Entity ID being acted on.
  entity_id BIGINT UNSIGNED NULL,

  -- JSON metadata.
  metadata JSON NULL,

  -- Creation timestamp.
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Audit lookups.
  INDEX idx_audit_actor (actor_type, actor_id),
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;