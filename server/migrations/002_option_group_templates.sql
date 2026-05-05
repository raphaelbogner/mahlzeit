-- Migration 002: workspace-scoped option group templates.
-- A user can save any option group on any dish as a reusable template
-- and insert it into another dish later. Templates live per workspace.
--
-- Idempotent via IF NOT EXISTS.

SET NAMES utf8mb4;

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
