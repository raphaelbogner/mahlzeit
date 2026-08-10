-- Mahlzeit — Database schema
-- MySQL 8 / utf8mb4. Run once on a fresh database.
-- Tables are ordered so foreign keys can be created top-down.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS workspaces (
  id            BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  token         CHAR(43) NOT NULL UNIQUE,
  name          VARCHAR(120) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS restaurants (
  id            CHAR(16) PRIMARY KEY,
  workspace_id  BIGINT UNSIGNED NOT NULL,
  name          VARCHAR(200) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  INDEX (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dishes (
  id                CHAR(16) PRIMARY KEY,
  restaurant_id     CHAR(16) NOT NULL,
  name              VARCHAR(200) NOT NULL,
  category          VARCHAR(80) NOT NULL DEFAULT '',
  description       VARCHAR(500) NOT NULL DEFAULT '',
  base_price_cents  INT NOT NULL DEFAULT 0,
  is_vegetarian     TINYINT(1) NOT NULL DEFAULT 0,
  sort_order        INT NOT NULL DEFAULT 0,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  INDEX (restaurant_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dish_option_groups (
  id              CHAR(16) PRIMARY KEY,
  dish_id         CHAR(16) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  selection_type  ENUM('single','multi') NOT NULL,
  max_select      INT NULL,
  sort_order      INT NOT NULL DEFAULT 0,
  FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE,
  INDEX (dish_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dish_options (
  id                CHAR(16) PRIMARY KEY,
  group_id          CHAR(16) NOT NULL,
  name              VARCHAR(200) NOT NULL,
  price_delta_cents INT NOT NULL DEFAULT 0,
  sort_order        INT NOT NULL DEFAULT 0,
  FOREIGN KEY (group_id) REFERENCES dish_option_groups(id) ON DELETE CASCADE,
  INDEX (group_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id                CHAR(16) PRIMARY KEY,
  workspace_id      BIGINT UNSIGNED NOT NULL,
  title             VARCHAR(200) NOT NULL,
  restaurant_id     CHAR(16) NULL,
  restaurant_name   VARCHAR(200) NOT NULL DEFAULT '',
  deadline          VARCHAR(50)  NOT NULL DEFAULT '',
  creator_id        CHAR(16) NOT NULL,
  creator_name      VARCHAR(120) NOT NULL,
  creator_iban      VARCHAR(34)  NOT NULL DEFAULT '',
  status            ENUM('open','closed') NOT NULL DEFAULT 'open',
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at         DATETIME NULL,
  paid_by_user_id   CHAR(16)     NULL,
  paid_by_user_name VARCHAR(120) NOT NULL DEFAULT '',
  paid_by_iban      VARCHAR(34)  NOT NULL DEFAULT '',
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE SET NULL,
  INDEX (workspace_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS items (
  id            CHAR(16) PRIMARY KEY,
  session_id    CHAR(16) NOT NULL,
  user_id       CHAR(16) NOT NULL,
  user_name     VARCHAR(120) NOT NULL,
  dish_id       CHAR(16) NULL,
  dish          VARCHAR(200) NOT NULL,
  note          VARCHAR(300) NOT NULL DEFAULT '',
  price_cents   INT NULL,
  options_json  TEXT NULL,
  added_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at       DATETIME NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE SET NULL,
  INDEX (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Workspace-scoped option group templates. A user can save any option group
-- on any dish as a reusable template and insert it into another dish later.
CREATE TABLE IF NOT EXISTS option_group_templates (
  id              CHAR(16) PRIMARY KEY,
  workspace_id    BIGINT UNSIGNED NOT NULL,
  name            VARCHAR(120) NOT NULL,
  selection_type  ENUM('single','multi') NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  INDEX (workspace_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS option_group_template_options (
  id                CHAR(16) PRIMARY KEY,
  template_id       CHAR(16) NOT NULL,
  name              VARCHAR(200) NOT NULL,
  price_delta_cents INT NOT NULL DEFAULT 0,
  sort_order        INT NOT NULL DEFAULT 0,
  FOREIGN KEY (template_id) REFERENCES option_group_templates(id) ON DELETE CASCADE,
  INDEX (template_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admins (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  username        VARCHAR(60) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rate-limiting buckets for /admin/api/login. One row per (ip, time-bucket).
-- Older rows are pruned opportunistically on each login attempt.
CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id           BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ip           VARCHAR(45) NOT NULL,
  attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (ip, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
