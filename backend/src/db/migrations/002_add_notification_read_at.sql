-- =============================================================================
-- Zwuwur backend migration 002
-- Add read_at column to notifications for proper read/unread tracking.
-- Backward compatible: column is nullable, defaults to NULL (unread).
-- =============================================================================

-- Add read_at column to notifications table.
ALTER TABLE notifications
  ADD COLUMN read_at DATETIME NULL DEFAULT NULL AFTER sent_at;

-- Add index for efficient "unread count" queries.
CREATE INDEX idx_notifications_user_unread ON notifications (user_id, read_at, created_at);
