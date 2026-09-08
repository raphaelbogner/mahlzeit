-- Migration 005: session-level discount.
-- Lets the payer apply a discount after closing (e.g. a free item from a
-- loyalty card). The client splits it proportionally across all orderers.
-- Idempotent via INFORMATION_SCHEMA checks (works on MySQL and MariaDB).
--
-- Adds:
--   sessions.discount_cents  — reduction in cents applied to the whole order
--                              (0 = no discount, the default)
--   sessions.discount_label  — optional note shown in the summary, e.g.
--                              "Gratis Dürüm (Stempelkarte)"

SET NAMES utf8mb4;
SET @schema := DATABASE();

-- sessions.discount_cents
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'discount_cents');
SET @sql := IF(@exists = 0,
  "ALTER TABLE sessions ADD COLUMN discount_cents INT NOT NULL DEFAULT 0 AFTER paid_by_iban",
  "DO 0");
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- sessions.discount_label
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'discount_label');
SET @sql := IF(@exists = 0,
  "ALTER TABLE sessions ADD COLUMN discount_label VARCHAR(120) NOT NULL DEFAULT '' AFTER discount_cents",
  "DO 0");
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
