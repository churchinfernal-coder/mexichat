import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { syncSignUpToMexivanza, syncSignInToMexivanza } from '@/services/mexivanzaSync';
import { autoFriendAdmin } from '@/services/adminService';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TYPES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CONTEXT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_ROLES = ['admin', 'super_admin'];
const PROFILE_RETRY_ATTEMPTS = 5;
const PROFILE_RETRY_BASE_MS = 400;

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// HELPERS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function isValidAccountType(value: unknown): value is AccountType {
  return value === 'user' || value === 'client'; // 'client' accepted for back-compat
}

/**
 * Wait for the profile row to appear (created by the DB trigger).
 * Returns the profile data or null after all retries are exhausted.
 */
async function waitForProfile(
  userId: string,
  retries: number = PROFILE_RETRY_ATTEMPTS,
): Promise<{ account_type: string } | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const { data, error } = await (supabase
      .from('profiles' as any)
      .select('account_type')
      .eq('id', userId)
      .maybeSingle() as any);

    if (!error && data?.account_type) return data;

    // Profile doesn't exist yet – exponential backoff
    if (attempt < retries - 1) {
      await new Promise((r) => setTimeout(r, PROFILE_RETRY_BASE_MS * (attempt + 1)));
    }
  }
  return null;
}

/**
 * Try to recover session from localStorage as a last resort.
 * iOS PWA sometimes reports no session even though tokens are stored.
 */
function tryRecoverSessionFromStorage(): { access_token: string; refresh_token: string } | null {
  try {
    const storageKey = Object.keys(localStorage).find(
      (k) => k.startsWith('sb-') && k.endsWith('-auth-token'),
    );
    if (!storageKey) return null;

    const stored = localStorage.getItem(storageKey);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    if (parsed?.refresh_token) {
      return {
        access_token: parsed.access_token || '',
        refresh_token: parsed.refresh_token,
      };
    }
  } catch {}
  return null;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PROVIDER
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>('user');

  const lastLoadedUserId = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const recoveryAttemptedRef = useRef(false);

  // â”€â”€ Load account type from profiles table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€ Check admin role â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const checkAdminRole = useCallback(async (authUser: User) => {
    try {
      // 1. Check user_metadata first (fastest)
      const metaRole = authUser.user_metadata?.role;
      if (typeof metaRole === 'string' && ADMIN_ROLES.includes(metaRole)) {
        setIsAdmin(true);
        return;
      }

      // 2. Check user_roles table
      const { data, error } = await (supabase
        .from('user_roles' as any)
        .select('role')
        .eq('user_id', authUser.id)
        .maybeSingle() as any);

      if (!error && data?.role && ADMIN_ROLES.includes(data.role)) {
        setIsAdmin(true);
        return;
      }

      setIsAdmin(false);
    } catch {
      setIsAdmin(false);
    }
  }, []);

  // â”€â”€ Handle session changes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€ Auth listener (stable – no dependency on handleSession) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  useEffect(() => {
    // STEP 1: Listen for auth changes
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

    // STEP 2: Get existing session (page refresh / PWA relaunch)
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (!initializedRef.current) {
        handleSessionRef.current?.(existingSession);
        initializedRef.current = true;
        setLoading(false);
      }
    });

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // STEP 3: iOS PWA – Re-check session when app resumes from background
    //
    // This is the critical fix for "app logs out when closed on iPhone".
    // iOS kills the WebView when the PWA is backgrounded. When it resumes,
    // the JS context is fresh but localStorage may still have tokens.
    //
    // Strategy:
    //   1. Try getSession() – works if Supabase SDK still has it cached
    //   2. Try refreshSession() – works if refresh token is still valid
    //   3. Try recovering from localStorage directly – last resort
    //   4. NEVER force logout – let user navigate naturally to login
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;

      supabase.auth.getSession().then(({ data: { session: refreshedSession } }) => {
        if (refreshedSession) {
          // Session still valid – update state silently
          setSession(refreshedSession);
          setUser(refreshedSession.user);
          recoveryAttemptedRef.current = false;
          return;
        }

        // Session is null – try to refresh
        supabase.auth.refreshSession().then(({ data: { session: newSession }, error }) => {
          if (newSession) {
            handleSessionRef.current?.(newSession);
            recoveryAttemptedRef.current = false;
            console.log('[Auth] âœ… Session refreshed on visibility change');
            return;
          }

          // refreshSession also failed – try localStorage recovery (once per resume)
          if (error && !recoveryAttemptedRef.current) {
            recoveryAttemptedRef.current = true;
            console.warn('[Auth] Session refresh failed:', error.message, '– attempting localStorage recovery');

            const stored = tryRecoverSessionFromStorage();
            if (stored) {
              supabase.auth.setSession({
                access_token: stored.access_token,
                refresh_token: stored.refresh_token,
              }).then(({ data: { session: recoveredSession } }) => {
                if (recoveredSession) {
                  handleSessionRef.current?.(recoveredSession);
                  console.log('[Auth] âœ… Session recovered from localStorage');
                } else {
                  console.warn('[Auth] localStorage recovery failed – user will need to re-login');
                  // DON'T call signOut() or clear state here.
                  // Let the user stay on the current page. They'll hit a
                  // permission error naturally if they try to do something
                  // that requires auth, and the UI will redirect to /auth.
                }
              }).catch(() => {
                console.warn('[Auth] setSession from localStorage threw');
              });
            } else {
              console.warn('[Auth] No stored tokens found – user will need to re-login');
            }
          }
        });
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // STEP 3b: iOS PWA – Handle "pageshow" event (fires when restored from bfcache)
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        console.log('[Auth] Page restored from bfcache – re-checking session');
        handleVisibilityChange();
      }
    };
    window.addEventListener('pageshow', handlePageShow);

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // STEP 4: Proactive token refresh every 4 minutes
    //
    // Was 10 minutes – too slow for iOS which can kill the app between
    // intervals. 4 minutes ensures the token is always fresh when the
    // user returns.
    //
    // Only refreshes if token expires within 10 minutes (600 seconds).
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const refreshInterval = setInterval(() => {
      supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
        if (!currentSession) return;

        const expiresAt = currentSession.expires_at ?? 0;
        const now = Math.floor(Date.now() / 1000);

        // Refresh if less than 10 minutes remaining
        if (expiresAt - now < 600) {
          supabase.auth.refreshSession().then(({ data: { session: newSess } }) => {
            if (newSess) {
              setSession(newSess);
              setUser(newSess.user);
            }
          });
        }
      });
    }, 4 * 60 * 1000);

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // CLEANUP
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      clearInterval(refreshInterval);
    };
  }, []); // â† Stable: no dependencies that change

  // â”€â”€ Public API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const refreshProfile = useCallback(async () => {
    if (user) {
      lastLoadedUserId.current = null;
      await loadAccountType(user.id);
    }
  }, [user, loadAccountType]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      // Fire-and-forget: also sign in on MexiVanza for community access
      syncSignInToMexivanza(email, password);
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
      // Fire-and-forget: auto-register on MexiVanza
      syncSignUpToMexivanza(email, password, fullName);
      autoFriendAdmin(data.user.id);
    }

    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    lastLoadedUserId.current = null;
    recoveryAttemptedRef.current = false;
    await supabase.auth.signOut();
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// HOOK
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};