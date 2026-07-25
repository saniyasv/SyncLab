import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/Navbar';
import { useRooms } from '@/context/RoomContext';
import type { ApiError } from '@/types';
import { ArrowLeft, X, Plus, Minus, Infinity as InfinityIcon, Globe, Lock, Users } from 'lucide-react';

const LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'cpp', 'html', 'css', 'go', 'rust', 'json',
];

export default function CreateRoomPage() {
  const { createRoom } = useRooms();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [maxCapacity, setMaxCapacity] = useState(0); // 0 = unlimited
  const [unlimited, setUnlimited] = useState(true);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t) && tags.length < 5) {
      setTags([...tags, t]);
      setTagInput('');
    }
  }
  function removeTag(tag: string) { setTags(tags.filter((t) => t !== tag)); }

  function handleCapacityChange(val: number) {
    setUnlimited(false);
    setMaxCapacity(Math.max(1, val));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(''); setFieldErrors({}); setSubmitting(true);
    try {
      const capacity = unlimited ? 0 : maxCapacity;
      const room = await createRoom({ name, description, language, tags, is_public: isPublic, max_capacity: capacity });
      navigate(`/room/${room.id}`);
    } catch (err) {
      const e = err as ApiError;
      setError(e.message);
      setFieldErrors(e.errors || {});
    } finally { setSubmitting(false); }
  }

  return (
    <PageLayout>
      <button onClick={() => navigate('/dashboard')}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition mb-6">
        <ArrowLeft size={16} /> Back to dashboard
      </button>

      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-white tracking-tight mb-1.5">Create a new room</h1>
        <p className="text-slate-400 mb-8">Set up a collaborative space for your team</p>

        {error && (
          <div className="mb-5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="glass-card rounded-xl p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Room name</label>
            <input type="text" className="input-field" placeholder="e.g. Frontend Sprint Review"
              value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
            {fieldErrors.name && <p className="text-xs text-red-400 mt-1">{fieldErrors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Description</label>
            <textarea className="input-field resize-none" rows={3} placeholder="What is this room about?"
              value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
            {fieldErrors.description && <p className="text-xs text-red-400 mt-1">{fieldErrors.description}</p>}
          </div>

          {/* Language */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Language</label>
            <select className="input-field" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (<option key={l} value={l} className="bg-[#0a0c14]">{l}</option>))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
              Tags <span className="text-slate-600 normal-case">(max 5)</span>
            </label>
            <div className="flex gap-2">
              <input type="text" className="input-field" placeholder="Add a tag and press Enter"
                value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
              <button type="button" onClick={addTag}
                className="px-4 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition flex items-center">
                <Plus size={18} />
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-blue-100"><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Capacity */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
              Max People in Room
            </label>
            <div className="flex items-center gap-3 mb-3">
              <button type="button" onClick={() => { setUnlimited(true); setMaxCapacity(0); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition text-sm font-medium ${
                  unlimited ? 'border-blue-500/40 bg-blue-500/15 text-blue-300' : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                }`}>
                <InfinityIcon size={16} /> Unlimited
              </button>
              <button type="button" onClick={() => { setUnlimited(false); setMaxCapacity(Math.max(1, maxCapacity || 1)); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition text-sm font-medium ${
                  !unlimited ? 'border-blue-500/40 bg-blue-500/15 text-blue-300' : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                }`}>
                <Users size={16} /> Set Limit
              </button>
            </div>
            {!unlimited && (
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => handleCapacityChange(maxCapacity - 1)}
                  className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition flex items-center justify-center">
                  <Minus size={16} />
                </button>
                <input type="number" min={1} className="input-field !w-24 text-center !text-lg font-display font-semibold"
                  value={maxCapacity} onChange={(e) => handleCapacityChange(parseInt(e.target.value) || 1)} />
                <button type="button" onClick={() => handleCapacityChange(maxCapacity + 1)}
                  className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition flex items-center justify-center">
                  <Plus size={16} />
                </button>
                <span className="text-sm text-slate-500">people can enter this room</span>
              </div>
            )}
            {unlimited && (
              <p className="text-xs text-slate-500">Anyone can join — no limit on the number of participants.</p>
            )}
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">Room Access</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setIsPublic(true)}
                className={`flex items-start gap-3 p-4 rounded-lg border transition text-left ${
                  isPublic ? 'border-blue-500/40 bg-blue-500/10' : 'border-white/10 bg-white/5 hover:bg-white/8'
                }`}>
                <Globe size={20} className={isPublic ? 'text-blue-400' : 'text-slate-500'} />
                <div>
                  <p className={`text-sm font-medium ${isPublic ? 'text-blue-300' : 'text-slate-300'}`}>Public</p>
                  <p className="text-xs text-slate-500 mt-0.5">Anyone with the link can join</p>
                </div>
              </button>
              <button type="button" onClick={() => setIsPublic(false)}
                className={`flex items-start gap-3 p-4 rounded-lg border transition text-left ${
                  !isPublic ? 'border-blue-500/40 bg-blue-500/10' : 'border-white/10 bg-white/5 hover:bg-white/8'
                }`}>
                <Lock size={20} className={!isPublic ? 'text-blue-400' : 'text-slate-500'} />
                <div>
                  <p className={`text-sm font-medium ${!isPublic ? 'text-blue-300' : 'text-slate-300'}`}>Private</p>
                  <p className="text-xs text-slate-500 mt-0.5">Only invited people can enter</p>
                </div>
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => navigate('/dashboard')}
              className="px-5 py-3 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition font-medium text-sm">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="btn-primary !w-auto flex-1 disabled:opacity-50">
              {submitting ? 'Creating…' : 'Create room'}
            </button>
          </div>
        </form>
      </div>
    </PageLayout>
  );
}
