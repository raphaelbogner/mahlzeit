-- Migration 011: web push.
-- push_subscriptions: one row per browser/device subscription (per workspace
--   and user). Removed when the push service reports the endpoint gone.
-- push_outbox: queued notifications, sent by cron/push_tick.php so requests
--   never wait on push services (shared hosting).
-- sessions.deadline_notified_at / items.reminder_sent_at: dedupe flags for
--   the cron-driven "deadline in 15 min" and "still unpaid" notifications.

SET NAMES utf8mb4;
SET @schema := DATABASE();

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id               CHAR(16) PRIMARY KEY,
  workspace_id     BIGINT UNSIGNED NOT NULL,
  user_id          CHAR(16) NOT NULL,
  endpoint         VARCHAR(500) NOT NULL,
  p256dh           VARCHAR(200) NOT NULL,
  auth             VARCHAR(100) NOT NULL,
  user_agent       VARCHAR(200) NOT NULL DEFAULT '',
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_success_at  DATETIME NULL,
  fail_count       INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_push_endpoint (endpoint),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  INDEX (workspace_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS push_outbox (
  id               BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  subscription_id  CHAR(16) NOT NULL,
  payload_json     TEXT NOT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at          DATETIME NULL,
  attempts         INT NOT NULL DEFAULT 0,
  last_error       VARCHAR(200) NULL,
  FOREIGN KEY (subscription_id) REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  INDEX (sent_at, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- sessions.deadline_notified_at
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'deadline_notified_at');
SET @sql := IF(@exists = 0,
  "ALTER TABLE sessions ADD COLUMN deadline_notified_at DATETIME NULL AFTER deadline_at",
  "DO 0");
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- items.reminder_sent_at
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'items' AND COLUMN_NAME = 'reminder_sent_at');
SET @sql := IF(@exists = 0,
  "ALTER TABLE items ADD COLUMN reminder_sent_at DATETIME NULL AFTER payment_reported_at",
  "DO 0");
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
