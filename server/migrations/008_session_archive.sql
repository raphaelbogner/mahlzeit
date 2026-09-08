-- Migration 008: session archive.
-- archived_at is set automatically 30 days after closing when nothing is left
-- to pay, or manually by the creator / payer. archived_by_user_id is NULL for
-- automatic archiving. Nothing is deleted.
-- Idempotent via INFORMATION_SCHEMA checks (works on MySQL and MariaDB).

SET NAMES utf8mb4;
SET @schema := DATABASE();

-- sessions.archived_at
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'archived_at');
SET @sql := IF(@exists = 0,
  "ALTER TABLE sessions ADD COLUMN archived_at DATETIME NULL AFTER auto_closed",
  "DO 0");
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- sessions.archived_by_user_id
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'archived_by_user_id');
SET @sql := IF(@exists = 0,
  "ALTER TABLE sessions ADD COLUMN archived_by_user_id CHAR(16) NULL AFTER archived_at",
  "DO 0");
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- index for the archive housekeeping update
SET @exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'sessions' AND INDEX_NAME = 'idx_sessions_archived');
SET @sql := IF(@exists = 0,
  "ALTER TABLE sessions ADD INDEX idx_sessions_archived (workspace_id, archived_at)",
  "DO 0");
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
