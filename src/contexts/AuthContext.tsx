import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { clearSupabaseAuthArtifacts, supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { syncSignUpToMexivanza, syncSignInToMexivanza, signOutMexivanza } from '@/services/mexivanzaSync';
import { autoFriendAdmin } from '@/services/adminService';

export type AccountType = 'user';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  accountType: AccountType;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_ROLES = ['admin', 'super_admin'];
const PROFILE_RETRY_ATTEMPTS = 5;
const PROFILE_RETRY_BASE_MS = 400;

type ProfileAccountType = Pick<Database['public']['Tables']['profiles']['Row'], 'account_type'>;
type UserRoleRow = Pick<Database['public']['Tables']['user_roles']['Row'], 'role'>;

function isValidAccountType(value: unknown): value is AccountType {
  return value === 'user';
}

async function waitForProfile(
  userId: string,
  retries: number = PROFILE_RETRY_ATTEMPTS,
): Promise<{ account_type: string } | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('account_type')
      .eq('id', userId)
      .maybeSingle();

    const typed = data as ProfileAccountType | null;
    if (!error && typeof typed?.account_type === 'string') {
      return { account_type: typed.account_type };
    }

    if (attempt < retries - 1) {
      await new Promise((r) => setTimeout(r, PROFILE_RETRY_BASE_MS * (attempt + 1)));
    }
  }
  return null;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>('user');

  const lastLoadedUserId = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const refreshInFlightRef = useRef(false);

  const loadAccountType = useCallback(async (userId: string) => {
    if (lastLoadedUserId.current === userId) return;

    const profile = await waitForProfile(userId);

    lastLoadedUserId.current = userId;

    if (profile && isValidAccountType(profile.account_type)) {
      setAccountType('user');
    } else {
      setAccountType('user');
    }
  }, []);

  const checkAdminRole = useCallback(async (authUser: User) => {
    try {
      const metaRole = authUser.user_metadata?.['role'];
      if (typeof metaRole === 'string' && ADMIN_ROLES.includes(metaRole)) {
        setIsAdmin(true);
        return;
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authUser.id)
        .maybeSingle();

      const typedRole = data as UserRoleRow | null;

      if (!error && typeof typedRole?.role === 'string' && ADMIN_ROLES.includes(typedRole.role)) {
        setIsAdmin(true);
        return;
      }

      setIsAdmin(false);
    } catch {
      setIsAdmin(false);
    }
  }, []);

  const handleSessionRef = useRef<(newSession: Session | null) => void>();

  handleSessionRef.current = (newSession: Session | null) => {
    setSession(newSession);
    setUser(newSession?.user ?? null);

    if (newSession?.user) {
      const userId = newSession.user.id;
      const authUser = newSession.user;
      Promise.resolve().then(() => {
        checkAdminRole(authUser);
        loadAccountType(userId);
      });
    } else {
      setIsAdmin(false);
      setAccountType('user');
      lastLoadedUserId.current = null;
    }
  };

  const runSessionRefresh = useCallback(async (clearOnFailure: boolean) => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;

    try {
      const { data: { session: refreshedSession } } = await supabase.auth.getSession();
      if (refreshedSession) {
        handleSessionRef.current?.(refreshedSession);
        return;
      }

      const { data: { session: newSession }, error } = await supabase.auth.refreshSession();
      if (newSession) {
        handleSessionRef.current?.(newSession);
        return;
      }

      if (error && clearOnFailure) {
        handleSessionRef.current?.(null);
      }
    } finally {
      refreshInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          handleSessionRef.current?.(newSession);
        } else if (event === 'SIGNED_OUT') {
          handleSessionRef.current?.(null);
        }

        if (!initializedRef.current) {
          initializedRef.current = true;
          setLoading(false);
        }
      },
    );

    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (!initializedRef.current) {
        handleSessionRef.current?.(existingSession);
        initializedRef.current = true;
        setLoading(false);
      }
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      void runSessionRefresh(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        handleVisibilityChange();
      }
    };
    window.addEventListener('pageshow', handlePageShow);

    const refreshInterval = setInterval(() => {
      supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
        if (!currentSession) return;

        const expiresAt = currentSession.expires_at ?? 0;
        const now = Math.floor(Date.now() / 1000);

        if (expiresAt - now < 600) {
          void runSessionRefresh(false);
        }
      });
    }, 4 * 60 * 1000);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      clearInterval(refreshInterval);
    };
  }, [runSessionRefresh]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      lastLoadedUserId.current = null;
      await loadAccountType(user.id);
    }
  }, [user, loadAccountType]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      await syncSignInToMexivanza(email, password);
    }
    return { error };
  }, []);

  const signUp = useCallback(async (
    email: string,
    password: string,
    fullName: string,
  ) => {
    const redirectUrl = `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          account_type: 'user',
        },
      },
    });

    if (error) return { error };

    if (data.user) {
      await waitForProfile(data.user.id);
      setAccountType('user');
      await syncSignUpToMexivanza(email, password, fullName);
      autoFriendAdmin(data.user.id);
    }

    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    lastLoadedUserId.current = null;
    try {
      await signOutMexivanza();
    } finally {
      await supabase.auth.signOut();
      clearSupabaseAuthArtifacts();
    }
    setIsAdmin(false);
    setAccountType('user');
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAdmin,
        accountType,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};