import { type ReactNode } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { LayoutDashboard, Plus, User, LogOut, Code2 } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/create-room', label: 'Create Room', icon: Plus },
    { to: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#0a0c14]/80 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <div className="logo-mark !w-9 !h-9 !rounded-lg group-hover:scale-105 transition-transform">
            <Code2 size={18} className="text-white" />
          </div>
          <span className="font-display text-lg font-semibold text-white tracking-tight">CollabHub</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link key={item.to} to={item.to}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                  active ? 'text-white bg-white/8' : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}>
                <item.icon size={16} /> {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-sm font-semibold text-white">
              {user?.name?.charAt(0).toUpperCase() || '?'}
            </div>
            <span className="text-sm text-slate-300 font-medium">{user?.name}</span>
          </div>
          <button onClick={() => { logout(); navigate('/login'); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition">
            <LogOut size={16} /><span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      <nav className="md:hidden flex items-center justify-around border-t border-white/5 px-2 py-2">
        {navItems.map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link key={item.to} to={item.to}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                active ? 'text-blue-400' : 'text-slate-500'
              }`}>
              <item.icon size={18} /> {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

export function PageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0c14]">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
