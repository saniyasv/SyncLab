import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageLayout } from '@/components/Navbar';
import { useRooms } from '@/context/RoomContext';
import { useAuth } from '@/context/AuthContext';
import type { DashboardStats } from '@/types';
import { Plus, Search, Users, Clock, Code2, ArrowRight, Globe, Lock, TrendingUp, Activity, Timer } from 'lucide-react';

const LANG_COLORS: Record<string, string> = {
  javascript: '#f7df1e', typescript: '#3178c6', python: '#3776ab',
  java: '#ed8b00', cpp: '#00599c', html: '#e34c26', css: '#264de4',
  go: '#00add8', rust: '#dea584', json: '#cbcb41',
};

export default function Dashboard() {
  const {
  rooms,
  loading,
  fetchRooms,
  getDashboardStats,
} = useRooms();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filterLang, setFilterLang] = useState('all');
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
  fetchRooms();

  getDashboardStats()
    .then(setStats)
    .catch(console.error);
}, [fetchRooms, getDashboardStats]);

  const languages = useMemo(() => {
    const set = new Set(rooms.map((r) => r.language));
    return ['all', ...Array.from(set)];
  }, [rooms]);

  const filtered = useMemo(() => {
    return rooms.filter((r) => {
      const matchesSearch = !search ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.description.toLowerCase().includes(search.toLowerCase()) ||
        r.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
      const matchesLang = filterLang === 'all' || r.language === filterLang;
      return matchesSearch && matchesLang;
    });
  }, [rooms, search, filterLang]);

  return (
    <PageLayout>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-semibold text-white tracking-tight">
            Welcome back, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-slate-400 mt-1.5">Your collaborative coding workspace</p>
        </div>
        <Link to="/create-room" className="btn-primary !w-auto flex items-center gap-2 px-5">
          <Plus size={18} /> New Room
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Timer size={20} className="text-blue-400" />
            </div>
            <TrendingUp size={16} className="text-slate-600" />
          </div>
          <p className="font-display text-2xl font-semibold text-white">
            {stats?.totalHours ?? 0}<span className="text-base text-slate-500 ml-1">hrs</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">Hours Collaborated</p>
        </div>

        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/15 flex items-center justify-center">
              <Activity size={20} className="text-green-400" />
            </div>
          </div>
          <p className="font-display text-2xl font-semibold text-white">{stats?.activeRooms ?? 0}</p>
          <p className="text-xs text-slate-500 mt-1">Active Rooms</p>
        </div>

        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/15 flex items-center justify-center">
              <Code2 size={20} className="text-indigo-400" />
            </div>
          </div>
          <p className="font-display text-2xl font-semibold text-white">{stats?.totalRooms ?? 0}</p>
          <p className="text-xs text-slate-500 mt-1">Total Rooms</p>
        </div>
      </div>

      {/* Recent rooms */}
      {stats?.recentRooms && stats.recentRooms.length > 0 && (
        <div className="mb-8">
          <h2 className="font-display text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock size={18} className="text-slate-500" /> Recent Rooms
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {stats.recentRooms.map((room) => (
              <Link key={room.id} to={`/room/${room.id}`}
                className="glass-card rounded-xl p-4 min-w-[220px] group hover:border-white/20 transition-all hover:-translate-y-0.5 flex-shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: LANG_COLORS[room.language] || '#94a3b8' }} />
                  <span className="text-xs font-mono-code text-slate-400 uppercase">{room.language}</span>
                </div>
                <h3 className="font-display text-base font-semibold text-white mb-1 group-hover:text-blue-400 transition truncate">{room.name}</h3>
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Users size={12} /> {room.member_count} members
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* All rooms */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" className="input-field !pl-11" placeholder="Search rooms by name, description, or tags…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input-field !w-auto" value={filterLang} onChange={(e) => setFilterLang(e.target.value)}>
          {languages.map((l) => (
            <option key={l} value={l} className="bg-[#0a0c14]">{l === 'all' ? 'All languages' : l}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-5 h-44 animate-pulse">
              <div className="h-4 w-1/2 bg-white/5 rounded mb-3" />
              <div className="h-3 w-3/4 bg-white/5 rounded mb-2" />
              <div className="h-3 w-2/3 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <Code2 size={40} className="mx-auto text-slate-600 mb-4" />
          <h3 className="font-display text-lg font-semibold text-white mb-1">
            {search || filterLang !== 'all' ? 'No rooms match your filters' : 'No rooms yet'}
          </h3>
          <p className="text-sm text-slate-400 mb-6">
            {search || filterLang !== 'all' ? 'Try adjusting your search or filters.' : 'Create your first room to start collaborating.'}
          </p>
          {!search && filterLang === 'all' && (
            <Link to="/create-room" className="btn-primary !w-auto inline-flex items-center gap-2 px-5">
              <Plus size={18} /> Create a room
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((room) => (
            <Link key={room.id} to={`/room/${room.id}`}
              className="glass-card rounded-xl p-5 group hover:border-white/20 transition-all duration-200 hover:-translate-y-0.5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: LANG_COLORS[room.language] || '#94a3b8' }} />
                  <span className="text-xs font-mono-code text-slate-400 uppercase tracking-wide">{room.language}</span>
                </div>
                {room.is_public ? <Globe size={15} className="text-slate-500" /> : <Lock size={15} className="text-slate-500" />}
              </div>
              <h3 className="font-display text-lg font-semibold text-white mb-1.5 group-hover:text-blue-400 transition">{room.name}</h3>
              <p className="text-sm text-slate-400 line-clamp-2 mb-4">{room.description || 'No description'}</p>
              {room.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {room.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-md bg-white/5 text-slate-400">{tag}</span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-white/5">
                <span className="flex items-center gap-1.5"><Users size={13} />
                  {room.member_count}{room.max_capacity > 0 ? ` / ${room.max_capacity}` : ''} members
                </span>
                <span className="flex items-center gap-1.5"><Clock size={13} />
                  {new Date(room.updated_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-blue-400 mt-3 opacity-0 group-hover:opacity-100 transition">
                Open room <ArrowRight size={13} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
