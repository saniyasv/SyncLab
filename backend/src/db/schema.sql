-- CollabHub database schema
-- Run via: npm run migrate

CREATE DATABASE IF NOT EXISTS collabhub
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE collabhub;

-- ── Users ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          VARCHAR(36) PRIMARY KEY,
  name        VARCHAR(80)  NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  avatar_url  TEXT NULL,
  bio         VARCHAR(200) NULL,
  role        ENUM('admin','member') NOT NULL DEFAULT 'member',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── Rooms ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id          VARCHAR(36) PRIMARY KEY,
  name        VARCHAR(80)   NOT NULL,
  description VARCHAR(300) NULL,
  language    VARCHAR(30)  NOT NULL DEFAULT 'javascript',
  tags        JSON NULL,
  owner_id    VARCHAR(36)  NOT NULL,
  is_public   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_rooms_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Room members ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_members (
  id         VARCHAR(36) PRIMARY KEY,
  room_id    VARCHAR(36) NOT NULL,
  user_id    VARCHAR(36) NOT NULL,
  role       ENUM('owner','editor','viewer') NOT NULL DEFAULT 'editor',
  joined_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_members_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  CONSTRAINT fk_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_room_user (room_id, user_id)
);

-- ── Messages ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id          VARCHAR(36) PRIMARY KEY,
  room_id     VARCHAR(36) NOT NULL,
  user_id     VARCHAR(36) NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_messages_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Files (code files per room) ─────────────────────────
CREATE TABLE IF NOT EXISTS room_files (
  id          VARCHAR(36) PRIMARY KEY,
  room_id     VARCHAR(36) NOT NULL,
  name        VARCHAR(255) NOT NULL DEFAULT 'main.js',
  language    VARCHAR(30) NOT NULL DEFAULT 'javascript',
  content     LONGTEXT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_files_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- ── Whiteboard shapes ──────────────────────────────────
CREATE TABLE IF NOT EXISTS whiteboard_shapes (
  id          VARCHAR(36) PRIMARY KEY,
  room_id     VARCHAR(36) NOT NULL,
  type        ENUM('rect','circle','line','text','pen') NOT NULL,
  props       JSON NOT NULL,
  created_by  VARCHAR(36) NOT NULL,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_shapes_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  CONSTRAINT fk_shapes_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Notifications ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         VARCHAR(36) PRIMARY KEY,
  user_id    VARCHAR(36) NOT NULL,
  type       VARCHAR(50) NOT NULL,
  title      VARCHAR(200) NOT NULL,
  body       VARCHAR(500) NULL,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Indexes ────────────────────────────────────────────
CREATE INDEX idx_rooms_owner ON rooms(owner_id);
CREATE INDEX idx_members_user ON room_members(user_id);
CREATE INDEX idx_messages_room ON messages(room_id, created_at);
CREATE INDEX idx_files_room ON room_files(room_id);
CREATE INDEX idx_shapes_room ON whiteboard_shapes(room_id);
CREATE INDEX idx_notif_user ON notifications(user_id, is_read);
