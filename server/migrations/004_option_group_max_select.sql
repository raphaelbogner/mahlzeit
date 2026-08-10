-- Migration 004: optional selection cap on option groups.
-- Apply once on existing deployments. Idempotent on both MySQL and MariaDB
-- via INFORMATION_SCHEMA checks.
--
-- Adds:
--   dish_option_groups.max_select — for selection_type='multi', the maximum
--     number of options that may be chosen (NULL = unlimited). Ignored for
--     'single' (which is always exactly one). Enables "choose up to N free
--     toppings" groups (e.g. the build-your-own pizza).

SET NAMES utf8mb4;
SET @schema := DATABASE();

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'dish_option_groups' AND COLUMN_NAME = 'max_select');
SET @sql := IF(@exists = 0,
  "ALTER TABLE dish_option_groups ADD COLUMN max_select INT NULL AFTER selection_type",
  "DO 0");
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
