-- Migration 009: two-step payment confirmation.
-- payment_reported_at: the orderer says "I transferred the money"; the payer
-- then confirms via paid_at. Cleared when the payer resets an item to unpaid.
-- Idempotent via INFORMATION_SCHEMA checks (works on MySQL and MariaDB).

SET NAMES utf8mb4;
SET @schema := DATABASE();

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'items' AND COLUMN_NAME = 'payment_reported_at');
SET @sql := IF(@exists = 0,
  "ALTER TABLE items ADD COLUMN payment_reported_at DATETIME NULL AFTER paid_at",
  "DO 0");
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
