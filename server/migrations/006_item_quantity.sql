-- Migration 006: quantity per item.
-- price_cents stays the unit price; the line total is price_cents * quantity.
-- Existing rows default to 1 and behave exactly as before.
-- Idempotent via INFORMATION_SCHEMA checks (works on MySQL and MariaDB).

SET NAMES utf8mb4;
SET @schema := DATABASE();

-- items.quantity
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'items' AND COLUMN_NAME = 'quantity');
SET @sql := IF(@exists = 0,
  "ALTER TABLE items ADD COLUMN quantity INT NOT NULL DEFAULT 1 AFTER price_cents",
  "DO 0");
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
