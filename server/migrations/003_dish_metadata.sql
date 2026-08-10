-- Migration 003: dish metadata (category, description, veggie flag).
-- Apply once on existing deployments. Idempotent on both MySQL and MariaDB
-- via INFORMATION_SCHEMA checks (MySQL doesn't support ADD COLUMN IF NOT
-- EXISTS, MariaDB does — this works on both).
--
-- Adds:
--   dishes.category       — grouping label shown in the picker (e.g. "Pizza",
--                           "Kebap"). Empty string = uncategorised.
--   dishes.description    — ingredient / description text shown under the dish
--                           name. Snapshotted into items? No: items already
--                           snapshot name+price+options; description is menu-only.
--   dishes.is_vegetarian  — 1 = vegetarian, shown with a badge in the picker.

SET NAMES utf8mb4;
SET @schema := DATABASE();

-- dishes.category
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'dishes' AND COLUMN_NAME = 'category');
SET @sql := IF(@exists = 0,
  "ALTER TABLE dishes ADD COLUMN category VARCHAR(80) NOT NULL DEFAULT '' AFTER name",
  "DO 0");
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- dishes.description
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'dishes' AND COLUMN_NAME = 'description');
SET @sql := IF(@exists = 0,
  "ALTER TABLE dishes ADD COLUMN description VARCHAR(500) NOT NULL DEFAULT '' AFTER category",
  "DO 0");
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- dishes.is_vegetarian
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'dishes' AND COLUMN_NAME = 'is_vegetarian');
SET @sql := IF(@exists = 0,
  "ALTER TABLE dishes ADD COLUMN is_vegetarian TINYINT(1) NOT NULL DEFAULT 0 AFTER base_price_cents",
  "DO 0");
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
