import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { PageLayout } from '@/components/Navbar';
import { useRooms } from '@/context/RoomContext';
import { useAuth } from '@/context/AuthContext';
import type { Room, RoomMember } from '@/types';
import type { ApiError } from '@/types';
import { ArrowLeft, Users, Code2, PenTool, MessageSquare, Play, Trash2, LogOut, Globe, Lock, Crown, Infinity as InfinityIcon } from 'lucide-react';

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { getRoom, getMembers, joinRoom, leaveRoom, deleteRoom } = useRooms();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    (async () => {
      try {
        const [r, m] = await Promise.all([getRoom(roomId), getMembers(roomId)]);
        setRoom(r);
        setMembers(m);
        setJoined(m.some((mem) => mem.user_id === user?.id));
      } catch (err) {
        setError((err as ApiError).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [roomId, getRoom, getMembers, user?.id]);

  async function handleJoin() {
    if (!roomId) return;
    try {
      await joinRoom(roomId);
      const m = await getMembers(roomId);
      setMembers(m);
      setJoined(true);
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleLeave() {
    if (!roomId) return;
    try {
      await leaveRoom(roomId);
      navigate('/dashboard');
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!roomId) return;
    if (!confirm('Delete this room permanently? This cannot be undone.')) return;
    try {
      await deleteRoom(roomId);
      navigate('/dashboard');
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  if (loading) {
    return (
      <PageLayout>
        <div className="glass-card rounded-xl p-12 animate-pulse">
          <div className="h-6 w-1/3 bg-white/5 rounded mb-4" />
          <div className="h-4 w-2/3 bg-white/5 rounded" />
        </div>
      </PageLayout>
    );
  }

  if (error || !room) {
    return (
      <PageLayout>
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="text-red-400 mb-4">{error || 'Room not found'}</p>
          <Link to="/dashboard" className="text-blue-400 hover:text-blue-300">Back to dashboard</Link>
        </div>
      </PageLayout>
    );
  }

  const isOwner = user?.id === room.owner_id;
  const isFull = room.max_capacity > 0 && room.member_count >= room.max_capacity;

  return (
    <PageLayout>
      <Link to="/dashboard" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition mb-6">
        <ArrowLeft size={16} /> Back to dashboard
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono-code text-slate-400 uppercase tracking-wide px-2 py-0.5 rounded-md bg-white/5">{room.language}</span>
                  {room.is_public ? (
                    <span className="flex items-center gap-1 text-xs text-slate-500"><Globe size={12} /> Public</span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-slate-500"><Lock size={12} /> Private</span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    {room.max_capacity > 0 ? <><Users size={12} /> {room.max_capacity} max</> : <><InfinityIcon size={12} /> Unlimited</>}
                  </span>
                </div>
                <h1 className="font-display text-2xl font-semibold text-white">{room.name}</h1>
                <p className="text-sm text-slate-400 mt-1">{room.description || 'No description'}</p>
              </div>
            </div>

            {room.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {room.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-md bg-white/5 text-slate-400">{tag}</span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-4 text-xs text-slate-500 pt-4 border-t border-white/5">
              <span className="flex items-center gap-1.5"><Users size={13} /> {room.member_count} members</span>
              <span>Created {new Date(room.created_at).toLocaleDateString()}</span>
              <span>Owner: {room.owner_name}</span>
            </div>
          </div>

          <div className="glass-card rounded-xl p-6">
            <h2 className="font-display text-lg font-semibold text-white mb-1">Ready to collaborate?</h2>
            <p className="text-sm text-slate-400 mb-5">
              {joined ? 'Enter the workspace to code, draw, and chat in real time.' : isFull ? 'This room is at full capacity.' : 'Join this room to start collaborating.'}
            </p>
            <div className="flex flex-wrap gap-3">
              {!joined && !isFull && (
                <button onClick={handleJoin} className="btn-primary !w-auto flex items-center gap-2 px-5">
                  <Users size={18} /> Join Room
                </button>
              )}
              {!joined && isFull && (
                <div className="px-5 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300">
                  Room is full ({room.member_count}/{room.max_capacity})
                </div>
              )}
              {joined && (
                <Link to={`/workspace/${room.id}`} className="btn-primary !w-auto flex items-center gap-2 px-5">
                  <Play size={18} /> Enter workspace
                </Link>
              )}
              {joined && !isOwner && (
                <button onClick={handleLeave}
                  className="flex items-center gap-2 px-5 py-3 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition font-medium text-sm">
                  <LogOut size={16} /> Leave room
                </button>
              )}
              {isOwner && (
                <button onClick={handleDelete}
                  className="flex items-center gap-2 px-5 py-3 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition font-medium text-sm">
                  <Trash2 size={16} /> Delete room
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-6">
          <h2 className="font-display text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users size={18} /> Members ({members.length})
            {room.max_capacity > 0 && <span className="text-xs text-slate-500">/ {room.max_capacity}</span>}
          </h2>
          <div className="space-y-2.5 max-h-96 overflow-y-auto">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-sm font-semibold text-white">
                  {m.user_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{m.user_name}</p>
                  <p className="text-xs text-slate-500 capitalize">{m.role}</p>
                </div>
                {m.role === 'owner' && <Crown size={15} className="text-amber-400" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <div className="glass-card rounded-xl p-5">
          <Code2 size={22} className="text-blue-400 mb-3" />
          <h3 className="font-display font-semibold text-white mb-1">Code Editor</h3>
          <p className="text-sm text-slate-400">Monaco-powered editor with live collaboration</p>
        </div>
        <div className="glass-card rounded-xl p-5">
          <PenTool size={22} className="text-indigo-400 mb-3" />
          <h3 className="font-display font-semibold text-white mb-1">Whiteboard</h3>
          <p className="text-sm text-slate-400">Draw and sketch together in real time</p>
        </div>
        <div className="glass-card rounded-xl p-5">
          <MessageSquare size={22} className="text-cyan-400 mb-3" />
          <h3 className="font-display font-semibold text-white mb-1">Live Chat</h3>
          <p className="text-sm text-slate-400">Message your team instantly</p>
        </div>
      </div>
    </PageLayout>
  );
}
