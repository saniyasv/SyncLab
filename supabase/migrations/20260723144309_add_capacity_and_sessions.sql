/*
# Add room capacity and collaboration session tracking

## Overview
Adds a max_capacity column to rooms (1 to infinity) so room owners can control
how many people can enter. Creates a room_sessions table to track how long each
user spends in a workspace, enabling "hours collaborated" stats on the dashboard.

## Changes to existing tables
1. `rooms` — add `max_capacity` integer column (default 0 = unlimited, 1+ = specific limit)

## New Tables
1. `room_sessions` — tracks each user's time in a room workspace
   - `id` (uuid, primary key)
   - `room_id` (uuid, FK to rooms)
   - `user_id` (uuid, FK to auth.users)
   - `joined_at` (timestamptz)
   - `left_at` (timestamptz, nullable)
   - `duration_seconds` (integer, computed when user leaves)

## Security (RLS)
- `room_sessions`: users can read their own sessions, insert when they join,
  update when they leave. No deletes.
*/

-- ── Add max_capacity to rooms ──────────────────────────
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS max_capacity integer NOT NULL DEFAULT 0;

-- ── Room sessions table ────────────────────────────────
CREATE TABLE IF NOT EXISTS room_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id          uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at        timestamptz NOT NULL DEFAULT now(),
  left_at          timestamptz,
  duration_seconds integer
);

ALTER TABLE room_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sessions_select_own" ON room_sessions;
CREATE POLICY "sessions_select_own" ON room_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sessions_insert_own" ON room_sessions;
CREATE POLICY "sessions_insert_own" ON room_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sessions_update_own" ON room_sessions;
CREATE POLICY "sessions_update_own" ON room_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON room_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_room ON room_sessions(room_id);
