import { useState, type FormEvent } from 'react';
import { PageLayout } from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import type { ApiError } from '@/types';
import { Save, Check } from 'lucide-react';

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(''); setFieldErrors({}); setSaved(false); setSubmitting(true);
    try {
      await updateProfile({ name, bio, avatar_url: avatarUrl || undefined });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      const e = err as ApiError;
      setError(e.message);
      setFieldErrors(e.errors || {});
    } finally { setSubmitting(false); }
  }

  return (
    <PageLayout>
      <h1 className="font-display text-3xl font-semibold text-white tracking-tight mb-1.5">Your profile</h1>
      <p className="text-slate-400 mb-8">Manage your account details</p>

      <div className="max-w-2xl space-y-6">
        <div className="glass-card rounded-xl p-6 flex items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-2xl font-semibold text-white flex-shrink-0">
            {user?.name?.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold text-white">{user?.name}</h2>
            <p className="text-sm text-slate-400">{user?.email}</p>
            <span className="inline-flex items-center gap-1.5 mt-2 text-xs px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20 capitalize">
              {user?.role}
            </span>
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="glass-card rounded-xl p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Full name</label>
            <input type="text" className="input-field" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
            {fieldErrors.name && <p className="text-xs text-red-400 mt-1">{fieldErrors.name}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Email</label>
            <input type="email" className="input-field opacity-50 cursor-not-allowed" value={user?.email || ''} disabled />
            <p className="text-xs text-slate-600 mt-1">Email cannot be changed</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Bio</label>
            <textarea className="input-field resize-none" rows={3} placeholder="Tell others about yourself"
              value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} />
            {fieldErrors.bio && <p className="text-xs text-red-400 mt-1">{fieldErrors.bio}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Avatar URL</label>
            <input type="url" className="input-field" placeholder="https://example.com/avatar.png"
              value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
            {fieldErrors.avatar_url && <p className="text-xs text-red-400 mt-1">{fieldErrors.avatar_url}</p>}
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={submitting}
              className="btn-primary !w-auto flex items-center gap-2 px-5 disabled:opacity-50">
              {saved ? <Check size={18} /> : <Save size={18} />}
              {saved ? 'Saved!' : submitting ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </PageLayout>
  );
}
