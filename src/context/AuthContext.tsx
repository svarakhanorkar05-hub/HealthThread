import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  profileError: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  profile: null,
  profileError: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let authEventReceived = false;
    let profileRequest = 0;

    const applySession = (nextSession: Session | null) => {
      const request = ++profileRequest;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setProfile(null);
        setProfileError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setProfileError(null);
      void supabase
        .from('profiles')
        .select('*')
        .eq('id', nextSession.user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!mounted || request !== profileRequest) return;
          if (error) {
            console.error('Error fetching profile:', error.message);
            setProfileError('Unable to load your profile. Please try again.');
          } else {
            setProfileError(null);
          }
          setProfile(data as Profile | null);
          setLoading(false);
        })
        .then(undefined, (error: unknown) => {
          if (!mounted || request !== profileRequest) return;
          console.error('Error fetching profile:', error);
          setProfile(null);
          setProfileError('Unable to load your profile. Please try again.');
          setLoading(false);
        });
    };

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventReceived = true;
      queueMicrotask(() => applySession(nextSession));
    });

    void supabase.auth
      .getSession()
      .then(({ data: { session: currentSession }, error }) => {
        if (error) console.error('Error restoring session:', error.message);
        if (mounted && !authEventReceived) applySession(currentSession);
      })
      .catch((error: unknown) => {
        if (!mounted || authEventReceived) return;
        console.error('Error restoring session:', error);
        setProfileError('Unable to restore your session. Please sign in again.');
        setLoading(false);
      });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error.message);
      setProfileError('Unable to load your profile. Please try again.');
      setProfile(null);
      return;
    }
    setProfile(data as Profile | null);
    setProfileError(null);
  }

  async function refreshProfile() {
    if (user) {
      setLoading(true);
      try {
        await fetchProfile(user.id);
      } catch (cause) {
        console.error('Error fetching profile:', cause);
        setProfile(null);
        setProfileError('Unable to load your profile. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null);
    setUser(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, profileError, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
