import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isOwnerRole, supabase, type UserProfile } from '../lib/supabase';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  profileExists: boolean;
  isLoadingSession: boolean;
  isLoadingProfile: boolean;
  isAuthenticated: boolean;
  isOwner: boolean;
  refreshProfile: () => Promise<void>;
  setProfileState: (nextProfile: UserProfile, exists?: boolean) => void;
  signOut: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileExists, setProfileExists] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  const user = session?.user ?? null;

  const fetchProfileForUser = useCallback(async (userId: string) => {
    setIsLoadingProfile(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, bio, avatar_url, role')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error al cargar el perfil:', error.message);
        setProfile({
          id: userId,
          username: null,
          bio: null,
          avatar_url: null,
          role: null,
        });
        setProfileExists(false);
        return;
      }

      if (data) {
        setProfile({
          id: data.id,
          username: data.username ?? null,
          bio: data.bio ?? null,
          avatar_url: data.avatar_url ?? null,
          role: data.role ?? null,
        });
        setProfileExists(true);
      } else {
        setProfile({
          id: userId,
          username: null,
          bio: null,
          avatar_url: null,
          role: null,
        });
        setProfileExists(false);
      }
    } catch (err) {
      console.error('Error inesperado al consultar profiles:', err);
      setProfile({
        id: userId,
        username: null,
        bio: null,
        avatar_url: null,
        role: null,
      });
      setProfileExists(false);
    } finally {
      setIsLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initializeSession() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!isMounted) return;
        if (error) {
          console.error('Error al verificar la sesión:', error.message);
          setSession(null);
        } else {
          setSession(data.session ?? null);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Error inesperado al verificar la sesión:', err);
        setSession(null);
      } finally {
        if (isMounted) {
          setIsLoadingSession(false);
        }
      }
    }

    void initializeSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession ?? null);
      setIsLoadingSession(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      setProfileExists(false);
      setIsLoadingProfile(false);
      return;
    }

    void fetchProfileForUser(user.id);
  }, [user?.id, fetchProfileForUser]);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    await fetchProfileForUser(user.id);
  }, [user?.id, fetchProfileForUser]);

  const setProfileState = useCallback(
    (nextProfile: UserProfile, exists = true) => {
      setProfile(nextProfile);
      setProfileExists(exists);
    },
    []
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { error: error.message };
    }
    setSession(null);
    setProfile(null);
    setProfileExists(false);
    return { error: null };
  }, []);

  const isOwner = isOwnerRole(profile?.role);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      profileExists,
      isLoadingSession,
      isLoadingProfile,
      isAuthenticated: Boolean(session?.user),
      isOwner,
      refreshProfile,
      setProfileState,
      signOut,
    }),
    [
      session,
      user,
      profile,
      profileExists,
      isLoadingSession,
      isLoadingProfile,
      isOwner,
      refreshProfile,
      setProfileState,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de un AuthProvider.');
  }
  return context;
}
