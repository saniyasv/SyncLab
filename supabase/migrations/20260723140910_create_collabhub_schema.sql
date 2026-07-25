/*
# Create CollabHub collaborative workspace schema

## Overview
Creates the full database schema for CollabHub — a real-time collaborative coding
workspace with rooms, code editor, whiteboard, chat, and member management.

## New Tables
1. `profiles` — user profile data (name, bio, avatar) linked to Supabase auth.users
2. `rooms` — collaborative rooms with name, description, language, tags, visibility
3. `room_members` — junction table linking users to rooms with roles (owner/editor/viewer)
4. `messages` — chat messages within rooms
5. `room_files` — code files belonging to rooms
6. `whiteboard_shapes` — shapes drawn on the collaborative whiteboard
7. `notifications` — user notifications

## Security (RLS)
- `profiles`: users can read all profiles, update only their own
- `rooms`: authenticated users can read all rooms, create/modify only owned rooms
- `room_members`: members can read; only room owner can insert/update/delete
- `messages`: room members can read and insert; users can delete their own
- `room_files`: room members can read; editors+ can write
- `whiteboard_shapes`: room members can read; editors+ can write
- `notifications`: users can read/update only their own
*/

-- ── Profiles ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL DEFAULT '',
  bio         text DEFAULT '',
  avatar_url  text DEFAULT '',
  role        text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- ── Rooms ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text DEFAULT '',
  language    text NOT NULL DEFAULT 'javascript',
  tags        text[] DEFAULT '{}',
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_public   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rooms_select_all" ON rooms;
CREATE POLICY "rooms_select_all" ON rooms FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "rooms_insert_own" ON rooms;
CREATE POLICY "rooms_insert_own" ON rooms FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "rooms_update_own" ON rooms;
CREATE POLICY "rooms_update_own" ON rooms FOR UPDATE
  TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "rooms_delete_own" ON rooms;
CREATE POLICY "rooms_delete_own" ON rooms FOR DELETE
  TO authenticated USING (auth.uid() = owner_id);

-- ── Room members ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'editor' CHECK (role IN ('owner','editor','viewer')),
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_select_room" ON room_members;
CREATE POLICY "members_select_room" ON room_members FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "members_insert_own" ON room_members;
CREATE POLICY "members_insert_own" ON room_members FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM room_members rm
      WHERE rm.room_id = room_members.room_id
        AND rm.user_id = auth.uid()
        AND rm.role = 'owner'
    )
  );

DROP POLICY IF EXISTS "members_update_owner_only" ON room_members;
CREATE POLICY "members_update_owner_only" ON room_members FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM room_members rm
      WHERE rm.room_id = room_members.room_id
        AND rm.user_id = auth.uid()
        AND rm.role = 'owner'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM room_members rm
      WHERE rm.room_id = room_members.room_id
        AND rm.user_id = auth.uid()
        AND rm.role = 'owner'
    )
  );

DROP POLICY IF EXISTS "members_delete_owner_or_self" ON room_members;
CREATE POLICY "members_delete_owner_or_self" ON room_members FOR DELETE
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM room_members rm
      WHERE rm.room_id = room_members.room_id
        AND rm.user_id = auth.uid()
        AND rm.role = 'owner'
    )
  );

-- ── Messages ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_room" ON messages;
CREATE POLICY "messages_select_room" ON messages FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "messages_insert_member" ON messages;
CREATE POLICY "messages_insert_member" ON messages FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = messages.room_id
        AND room_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "messages_delete_own" ON messages;
CREATE POLICY "messages_delete_own" ON messages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ── Room files ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name        text NOT NULL DEFAULT 'main.js',
  language    text NOT NULL DEFAULT 'javascript',
  content     text DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE room_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "files_select_room" ON room_files;
CREATE POLICY "files_select_room" ON room_files FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "files_insert_owner" ON room_files;
CREATE POLICY "files_insert_owner" ON room_files FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = room_files.room_id
        AND rooms.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "files_update_member" ON room_files;
CREATE POLICY "files_update_member" ON room_files FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = room_files.room_id
        AND room_members.user_id = auth.uid()
        AND room_members.role IN ('owner','editor')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = room_files.room_id
        AND room_members.user_id = auth.uid()
        AND room_members.role IN ('owner','editor')
    )
  );

DROP POLICY IF EXISTS "files_delete_owner" ON room_files;
CREATE POLICY "files_delete_owner" ON room_files FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = room_files.room_id
        AND rooms.owner_id = auth.uid()
    )
  );

-- ── Whiteboard shapes ──────────────────────────────────
CREATE TABLE IF NOT EXISTS whiteboard_shapes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('rect','circle','line','text','pen')),
  props       jsonb NOT NULL DEFAULT '{}',
  created_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE whiteboard_shapes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shapes_select_room" ON whiteboard_shapes;
CREATE POLICY "shapes_select_room" ON whiteboard_shapes FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "shapes_insert_member" ON whiteboard_shapes;
CREATE POLICY "shapes_insert_member" ON whiteboard_shapes FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = whiteboard_shapes.room_id
        AND room_members.user_id = auth.uid()
        AND room_members.role IN ('owner','editor')
    )
  );

DROP POLICY IF EXISTS "shapes_delete_member" ON whiteboard_shapes;
CREATE POLICY "shapes_delete_member" ON whiteboard_shapes FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = whiteboard_shapes.room_id
        AND room_members.user_id = auth.uid()
        AND room_members.role IN ('owner','editor')
    )
  );

-- ── Notifications ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       text NOT NULL,
  title      text NOT NULL,
  body       text DEFAULT '',
  is_read    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_select_own" ON notifications;
CREATE POLICY "notif_select_own" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_update_own" ON notifications;
CREATE POLICY "notif_update_own" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_insert_own" ON notifications;
CREATE POLICY "notif_insert_own" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- ── Indexes ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rooms_owner ON rooms(owner_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_room ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_files_room ON room_files(room_id);
CREATE INDEX IF NOT EXISTS idx_shapes_room ON whiteboard_shapes(room_id);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);

-- ── Auto-create profile on signup ───────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── updated_at triggers ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON profiles;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS rooms_set_updated_at ON rooms;
CREATE TRIGGER rooms_set_updated_at BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS files_set_updated_at ON room_files;
CREATE TRIGGER files_set_updated_at BEFORE UPDATE ON room_files
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
