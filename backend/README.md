# CollabHub Backend

The backend is powered by **Supabase** (PostgreSQL) — no separate server process needed.

## Architecture

The frontend (`frontend/`) connects directly to Supabase for:
- **Authentication**: email/password via Supabase Auth
- **Database**: PostgreSQL tables with Row Level Security (RLS)
- **Real-time**: Supabase real-time subscriptions for chat messages and whiteboard shapes

## Database Schema

All schema is managed through Supabase migrations. See `src/schema.sql` for the full reference.

### Tables

| Table | Purpose |
|---|---|
| `profiles` | User profiles (name, bio, avatar), auto-created on signup |
| `rooms` | Collaborative rooms with capacity limits and visibility |
| `room_members` | Room membership with roles (owner/editor/viewer) |
| `messages` | Chat messages |
| `room_files` | Code files (Monaco editor content) |
| `whiteboard_shapes` | Whiteboard drawings (rect, circle, text, pen) |
| `notifications` | User notifications |
| `room_sessions` | Time tracking for "hours collaborated" stats |

### Key Features
- `rooms.max_capacity`: 0 = unlimited, 1+ = specific limit on participants
- `room_sessions`: tracks join/leave times to compute collaboration hours
- Real-time via Supabase channels (no Socket.IO needed)

## Environment Variables

Set in `frontend/.env`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Migrations

## Migrations

Database migrations are managed through the **Supabase MCP Tool** rather than raw SQL execution. The files in `src/migrations/` provide a version-controlled history of all schema changes applied throughout the development of the project.
