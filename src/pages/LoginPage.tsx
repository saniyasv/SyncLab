import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { ApiError } from '@/types';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(''); setFieldErrors({}); setSubmitting(true);
    try { await login(email, password); navigate('/dashboard'); }
    catch (err) { const e = err as ApiError; setError(e.message); setFieldErrors(e.errors || {}); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="min-h-screen bg-[#0a0c14] relative overflow-hidden flex items-center justify-center px-6 py-10">
      <div className="absolute top-[-10%] left-[-5%] w-[420px] h-[420px] rounded-full bg-blue-600/20 blur-[120px] animate-float-1" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[380px] h-[380px] rounded-full bg-indigo-600/15 blur-[120px] animate-float-2" />
      <div className="absolute top-[30%] right-[20%] w-[260px] h-[260px] rounded-full bg-cyan-500/10 blur-[100px] animate-float-3" />

      <div className="relative w-full max-w-md animate-fade-up">
        <div className="glass-card rounded-2xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="logo-mark mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M8 6L2 12l6 6M16 6l6 6-6 6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="font-display text-2xl font-semibold text-white tracking-tight">Welcome back</h1>
            <p className="text-sm text-slate-400 mt-1.5">Sign in to your collaborative workspace</p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Email</label>
              <input type="email" className="input-field" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
              {fieldErrors.email && <p className="text-xs text-red-400 mt-1">{fieldErrors.email}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Password</label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} className="input-field pr-11" placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
                <button type="button" onClick={() => setShowPwd(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200 transition">
                  {showPwd ? 'Hide' : 'Show'}
                </button>
              </div>
              {fieldErrors.password && <p className="text-xs text-red-400 mt-1">{fieldErrors.password}</p>}
            </div>
            <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="divider my-6">or</div>
          <p className="text-center text-sm text-slate-400">
            Don't have an account?{' '}
            <Link to="/signup" className="text-blue-400 hover:text-blue-300 font-medium transition">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
