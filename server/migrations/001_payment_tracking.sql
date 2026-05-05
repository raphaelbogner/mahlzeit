-- Migration 001: payment tracking on sessions and items.
-- Apply once on existing deployments. Idempotent on both MySQL and MariaDB
-- via INFORMATION_SCHEMA checks (MySQL doesn't support ADD COLUMN IF NOT
-- EXISTS, MariaDB does — this works on both).
--
-- Adds:
--   sessions.paid_by_user_id    — who actually paid for the bill (NULL = creator
--                                  is the implicit payer, current default)
--   sessions.paid_by_user_name  — snapshot at the time the payer was marked
--   sessions.paid_by_iban       — snapshot, may be set later by the payer
--   items.paid_at               — set when the effective payer marks an item
--                                  as paid (struck through in the UI)

SET NAMES utf8mb4;
SET @schema := DATABASE();

-- sessions.paid_by_user_id
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'paid_by_user_id');
SET @sql := IF(@exists = 0,
  "ALTER TABLE sessions ADD COLUMN paid_by_user_id CHAR(16) NULL AFTER closed_at",
  "DO 0");
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- sessions.paid_by_user_name
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'paid_by_user_name');
SET @sql := IF(@exists = 0,
  "ALTER TABLE sessions ADD COLUMN paid_by_user_name VARCHAR(120) NOT NULL DEFAULT '' AFTER paid_by_user_id",
  "DO 0");
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- sessions.paid_by_iban
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'paid_by_iban');
SET @sql := IF(@exists = 0,
  "ALTER TABLE sessions ADD COLUMN paid_by_iban VARCHAR(34) NOT NULL DEFAULT '' AFTER paid_by_user_name",
  "DO 0");
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- items.paid_at
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'items' AND COLUMN_NAME = 'paid_at');
SET @sql := IF(@exists = 0,
  "ALTER TABLE items ADD COLUMN paid_at DATETIME NULL AFTER added_at",
  "DO 0");
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
