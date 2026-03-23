import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useOnlineStatus(userId: string | null) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tokenRef = useRef<string | null>(null);

  // Keep a synchronous copy of the JWT for use in beforeunload
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      tokenRef.current = data.session?.access_token ?? null;
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      tokenRef.current = session?.access_token ?? null;
    });
    return () => subscription.unsubscribe();
  }, []);

  const updateStatus = useCallback(async (online: boolean) => {
    if (!userId) return;
    try {
      await supabase
        .from('profiles')
        .update({
          is_online: online,
          last_seen: new Date().toISOString(),
        })
        .eq('id', userId);
    } catch { /* column may not exist yet */ }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    updateStatus(true);

    // Heartbeat every 60s
    intervalRef.current = setInterval(() => updateStatus(true), 60000);

    const handleVisChange = () => {
      updateStatus(document.visibilityState === 'visible');
    };

    const handleBeforeUnload = () => {
      const token = tokenRef.current;
      if (!token) return;
      // Use fetch with keepalive (sendBeacon only sends POST, not PATCH)
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`;
      const body = JSON.stringify({ is_online: false, last_seen: new Date().toISOString() });
      fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=minimal',
        },
        body,
        keepalive: true,
      }).catch(() => {});
    };

    document.addEventListener('visibilitychange', handleVisChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      updateStatus(false);
    };
  }, [userId, updateStatus]);
}