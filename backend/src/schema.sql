/*
# CollabHub — Complete Database Schema Reference

This file documents the full Supabase/PostgreSQL schema for CollabHub.
The actual migrations are applied via the Supabase MCP tool.

## Tables

1. **profiles** — user profiles (name, bio, avatar), linked to auth.users
   - Triggered auto-creation on signup via `handle_new_user()`

2. **rooms** — collaborative rooms
   - `max_capacity`: 0 = unlimited, 1+ = specific limit on how many people can enter

3. **room_members** — junction table (user ↔ room) with roles
   - Roles: owner, editor, viewer

4. **messages** — chat messages within rooms

5. **room_files** — code files belonging to rooms (Monaco editor content)

6. **whiteboard_shapes** — shapes drawn on the collaborative whiteboard
   - Types: rect, circle, line, text, pen
   - Props stored as JSONB

7. **notifications** — user notifications

8. **room_sessions** — tracks time spent in rooms for "hours collaborated" stats
   - `joined_at`: when user entered workspace
   - `left_at`: when user left
   - `duration_seconds`: computed on leave

## Security (RLS)
All tables have Row Level Security enabled:
- profiles: read all, update own
- rooms: read all, CRUD own
- room_members: read all, insert self/owner, update/delete owner-or-self
- messages: read all, insert members, delete own
- room_files: read all, write editors+
- whiteboard_shapes: read all, write editors+
- notifications: CRUD own only
- room_sessions: CRUD own only

## Triggers
- `on_auth_user_created`: auto-creates profile row on signup
- `set_updated_at`: auto-updates `updated_at` on profiles, rooms, room_files
*/
