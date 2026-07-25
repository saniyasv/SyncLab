export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  role: 'admin' | 'member';
  created_at: string;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  language: string;
  tags: string[];
  owner_id: string;
  owner_name: string;
  member_count: number;
  max_capacity: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoomMember {
  id: string;
  room_id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  role: 'owner' | 'editor' | 'viewer';
  joined_at: string;
  online: boolean;
}

export interface Message {
  id: string;
  room_id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  content: string;
  created_at: string;
}

export interface FileEntry {
  id: string;
  room_id: string;
  name: string;
  language: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface WhiteboardShape {
  id: string;
  room_id: string;
  type: 'rect' | 'circle' | 'line' | 'text' | 'pen';
  props: Record<string, unknown>;
  created_by: string;
  updated_at: string;
}

export interface RoomSession {
  id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
  duration_seconds: number | null;
}

export interface DashboardStats {
  totalHours: number;
  activeRooms: number;
  totalRooms: number;
  recentRooms: Room[];
}

export interface ApiError {
  message: string;
  errors?: Record<string, string>;
}
