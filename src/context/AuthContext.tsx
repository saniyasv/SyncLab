import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: { name?: string; bio?: string; avatar_url?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string): Promise<User | null> {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, name, bio, avatar_url, role, created_at')
      .eq('id', userId)
      .maybeSingle();
    if (error || !profile) return null;

    const { data: authData } = await supabase.auth.getUser();
    return {
      id: profile.id,
      name: profile.name,
      email: authData?.user?.email || '',
      avatar_url: profile.avatar_url || null,
      bio: profile.bio || null,
      role: profile.role as 'admin' | 'member',
      created_at: profile.created_at,
    };
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && mounted) {
        const profile = await loadProfile(session.user.id);
        if (mounted) setUser(profile);
      }
      if (mounted) setLoading(false);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (session?.user) {
          const profile = await loadProfile(session.user.id);
          if (mounted) setUser(profile);
        } else {
          if (mounted) setUser(null);
        }
        if (mounted) setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function login(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw { message: error.message };
  }

  async function signup(name: string, email: string, password: string) {
    const { error } = await supabase.auth.signUp({
      email, password, options: { data: { name } },
    });
    if (error) throw { message: error.message };
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  async function updateProfile(data: { name?: string; bio?: string; avatar_url?: string }) {
    if (!user) return;
    const updates: Record<string, string> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.bio !== undefined) updates.bio = data.bio;
    if (data.avatar_url !== undefined) updates.avatar_url = data.avatar_url;

    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (error) throw { message: error.message };
    setUser({ ...user, ...data });
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
