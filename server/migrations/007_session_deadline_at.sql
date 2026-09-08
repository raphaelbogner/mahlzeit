-- Migration 007: order deadline as a point in time + automatic closing.
-- The legacy free-text `deadline` column stays for old sessions; new sessions
-- only use deadline_at (stored in UTC). auto_closed marks sessions the server
-- closed because the deadline passed.
-- Idempotent via INFORMATION_SCHEMA checks (works on MySQL and MariaDB).

SET NAMES utf8mb4;
SET @schema := DATABASE();

-- sessions.deadline_at
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'deadline_at');
SET @sql := IF(@exists = 0,
  "ALTER TABLE sessions ADD COLUMN deadline_at DATETIME NULL AFTER deadline",
  "DO 0");
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- sessions.auto_closed
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'auto_closed');
SET @sql := IF(@exists = 0,
  "ALTER TABLE sessions ADD COLUMN auto_closed TINYINT(1) NOT NULL DEFAULT 0 AFTER closed_at",
  "DO 0");
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- index for the lazy auto-close update
SET @exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'sessions' AND INDEX_NAME = 'idx_sessions_deadline');
SET @sql := IF(@exists = 0,
  "ALTER TABLE sessions ADD INDEX idx_sessions_deadline (workspace_id, status, deadline_at)",
  "DO 0");
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
