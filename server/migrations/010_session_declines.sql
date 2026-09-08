-- Migration 010: "Heute nicht dabei" — a participant opts out of an open
-- session so the creator does not list them as missing. Adding an item
-- removes the decline again. One row per (session, user).

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS session_declines (
  session_id   CHAR(16) NOT NULL,
  user_id      CHAR(16) NOT NULL,
  user_name    VARCHAR(120) NOT NULL,
  declined_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id, user_id),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
