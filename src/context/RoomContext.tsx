import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Room, RoomMember, Message, DashboardStats } from '@/types';

interface RoomContextValue {
  rooms: Room[];
  loading: boolean;
  fetchRooms: () => Promise<void>;
  createRoom: (data: {
    name: string; description: string; language: string;
    tags: string[]; is_public: boolean; max_capacity: number;
  }) => Promise<Room>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: (roomId: string) => Promise<void>;
  deleteRoom: (roomId: string) => Promise<void>;
  getRoom: (roomId: string) => Promise<Room>;
  getMembers: (roomId: string) => Promise<RoomMember[]>;
  getMessages: (roomId: string) => Promise<Message[]>;
  getDashboardStats: () => Promise<DashboardStats>;
  startSession: (roomId: string) => Promise<string | null>;
  endSession: (sessionId: string) => Promise<void>;
}

const RoomContext = createContext<RoomContextValue | undefined>(undefined);

function formatRoom(r: Record<string, unknown>): Room {
  const owner = r.owner as Record<string, unknown> | null;
  const members = r.members as Array<{ count: number }> | null;
  return {
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string) || '',
    language: r.language as string,
    tags: (r.tags as string[]) || [],
    owner_id: r.owner_id as string,
    owner_name: (owner?.name as string) || 'Unknown',
    member_count: members?.[0]?.count || 0,
    max_capacity: (r.max_capacity as number) ?? 0,
    is_public: r.is_public as boolean,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

export function RoomProvider({ children }: { children: ReactNode }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRooms = useCallback(async () => {
  setLoading(true);
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select(`
        id,
        name,
        description,
        language,
        tags,
        owner_id,
        max_capacity,
        is_public,
        created_at,
        updated_at,
        owner:profiles!rooms_owner_id_fkey(name),
        members:room_members(count)
      `)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    setRooms((data || []).map(formatRoom));
  } finally {
    setLoading(false);
  }
}, []);

  const createRoom = useCallback(async (data: {
    name: string; description: string; language: string;
    tags: string[]; is_public: boolean; max_capacity: number;
  }) => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw { message: 'Not authenticated' };

    const { data: roomData, error } = await supabase
      .from('rooms')
      .insert({
        name: data.name, description: data.description, language: data.language,
        tags: data.tags, is_public: data.is_public, max_capacity: data.max_capacity,
        owner_id: authData.user.id,
      })
      .select('id, name, description, language, tags, owner_id, max_capacity, is_public, created_at, updated_at')
      .single();
    if (error) throw { message: error.message };

    await supabase.from('room_members')
      .insert({ room_id: roomData.id, user_id: authData.user.id, role: 'owner' });

    const ext = data.language === 'javascript' ? 'js'
      : data.language === 'typescript' ? 'ts'
      : data.language === 'python' ? 'py' : data.language;
    await supabase.from('room_files')
      .insert({ room_id: roomData.id, name: `main.${ext}`, language: data.language, content: '' });

    const { data: profile } = await supabase
      .from('profiles').select('name').eq('id', authData.user.id).maybeSingle();

    const room: Room = {
      ...roomData,
      tags: roomData.tags || [],
      owner_name: profile?.name || 'Unknown',
      member_count: 1,
    };
    setRooms((prev) => [room, ...prev]);
    return room;
  }, []);

  const joinRoom = useCallback(async (roomId: string) => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw { message: 'Not authenticated' };
    const { error } = await supabase.from('room_members')
      .insert({ room_id: roomId, user_id: authData.user.id, role: 'editor' });
    if (error && error.code !== '23505') throw { message: error.message };
    setRooms((prev) => prev.map((r) =>
      r.id === roomId ? { ...r, member_count: r.member_count + 1 } : r
    ));
  }, []);

  const leaveRoom = useCallback(async (roomId: string) => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw { message: 'Not authenticated' };
    const { error } = await supabase.from('room_members')
      .delete().eq('room_id', roomId).eq('user_id', authData.user.id);
    if (error) throw { message: error.message };
    setRooms((prev) => prev.map((r) =>
      r.id === roomId ? { ...r, member_count: Math.max(0, r.member_count - 1) } : r
    ));
  }, []);

  const deleteRoom = useCallback(async (roomId: string) => {
    const { error } = await supabase.from('rooms').delete().eq('id', roomId);
    if (error) throw { message: error.message };
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
  }, []);

  const getRoom = useCallback(async (roomId: string) => {
    const { data, error } = await supabase
      .from('rooms')
      .select(`
        id, name, description, language, tags, owner_id, max_capacity, is_public, created_at, updated_at,
        owner:profiles!rooms_owner_id_fkey(name),
        members:room_members(count)
      `)
      .eq('id', roomId).maybeSingle();
    if (error) throw { message: error.message };
    if (!data) throw { message: 'Room not found' };
    return formatRoom(data as Record<string, unknown>);
  }, []);

  const getMembers = useCallback(async (roomId: string) => {
  const { data, error } = await supabase
  .from('room_members')
  .select(`
    *,
    profiles(
      name,
      avatar_url
    )
  `)
  .eq('room_id', roomId)
  .order('joined_at', { ascending: true });

  if (error) throw { message: error.message };

  return (data || []).map((m: any) => ({
  id: m.id,
  room_id: m.room_id,
  user_id: m.user_id,
  user_name: m.profiles?.name || "Unknown",
  user_avatar: m.profiles?.avatar_url || null,
  role: m.role,
  joined_at: m.joined_at,
  online: false,
}));
}, []);

const getMessages = useCallback(async (roomId: string) => {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) throw { message: error.message };

  const userIds = [...new Set((data || []).map((m: any) => m.user_id))];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,name,avatar_url")
    .in("id", userIds);

  return (data || []).map((m: any) => {
    const profile = profiles?.find((p: any) => p.id === m.user_id);

    return {
      id: m.id,
      room_id: m.room_id,
      user_id: m.user_id,
      user_name: profile?.name || "Unknown",
      user_avatar: profile?.avatar_url || null,
      content: m.content,
      created_at: m.created_at,
    };
  }) as Message[];
}, []);

  const getDashboardStats = useCallback(async (): Promise<DashboardStats> => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return { totalHours: 0, activeRooms: 0, totalRooms: 0, recentRooms: [] };

    // Total hours from sessions
    const { data: sessions } = await supabase
      .from('room_sessions')
      .select('duration_seconds')
      .eq('user_id', authData.user.id)
      .not('duration_seconds', 'is', null);
    const totalSeconds = (sessions || []).reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
    const totalHours = Math.round((totalSeconds / 3600) * 10) / 10;

    // Total rooms and active rooms (rooms with at least 1 member)
    const { count: totalRooms } = await supabase
      .from('rooms').select('*', { count: 'exact', head: true });

    const { count: activeRooms } = await supabase
      .from('room_members').select('room_id', { count: 'exact', head: true })
      .eq('user_id', authData.user.id);

    // Recent rooms (last 5 rooms the user is a member of)
    const { data: memberRooms } = await supabase
      .from('room_members')
      .select(`
        room:rooms(
          id, name, description, language, tags, owner_id, max_capacity, is_public, created_at, updated_at,
          owner:profiles!rooms_owner_id_fkey(name),
          members:room_members(count)
        )
      `)
      .eq('user_id', authData.user.id)
      .order('joined_at', { ascending: false })
      .limit(5);

    const recentRooms = (memberRooms || [])
      .map((mr) => formatRoom(mr.room as unknown as Record<string, unknown>))
      .filter((r) => r.id);

    return {
      totalHours,
      activeRooms: activeRooms || 0,
      totalRooms: totalRooms || 0,
      recentRooms,
    };
  }, []);

  const startSession = useCallback(async (roomId: string): Promise<string | null> => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return null;
    const { data, error } = await supabase
      .from('room_sessions')
      .insert({ room_id: roomId, user_id: authData.user.id })
      .select('id').single();
    if (error) return null;
    return data.id;
  }, []);

  const endSession = useCallback(async (sessionId: string) => {
    if (!sessionId) return;
    const now = new Date();
    const { data: session } = await supabase
      .from('room_sessions').select('joined_at').eq('id', sessionId).maybeSingle();
    if (!session) return;
    const joined = new Date(session.joined_at);
    const duration = Math.floor((now.getTime() - joined.getTime()) / 1000);
    await supabase.from('room_sessions')
      .update({ left_at: now.toISOString(), duration_seconds: duration })
      .eq('id', sessionId);
  }, []);

  return (
    <RoomContext.Provider value={{
      rooms, loading, fetchRooms, createRoom, joinRoom, leaveRoom, deleteRoom,
      getRoom, getMembers, getMessages, getDashboardStats, startSession, endSession,
    }}>
      {children}
    </RoomContext.Provider>
  );
}

export function useRooms() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRooms must be used within RoomProvider');
  return ctx;
}
