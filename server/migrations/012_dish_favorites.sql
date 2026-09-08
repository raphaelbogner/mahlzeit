-- Migration 012: personal dish favorites (server-side so they follow the
-- profile across devices). Deleting a dish removes its favorites.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS dish_favorites (
  workspace_id  BIGINT UNSIGNED NOT NULL,
  user_id       CHAR(16) NOT NULL,
  dish_id       CHAR(16) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, dish_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE,
  INDEX (workspace_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
