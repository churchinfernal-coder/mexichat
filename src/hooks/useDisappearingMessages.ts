import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type DisappearTimer = 'off' | '5m' | '1h' | '24h' | '7d';

const TIMER_MS: Record<DisappearTimer, number> = {
  off: 0,
  '5m': 5 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

export function useDisappearingMessages(
  conversationId: string | null,
  table: 'conversations' | 'groups' = 'conversations'
) {
  const [timer, setTimerState] = useState<DisappearTimer>('off');

  useEffect(() => {
    if (!conversationId) return;
    supabase
      .from(table)
      .select('*')
      .eq('id', conversationId)
      .single()
      .then(({ data }) => {
        const row = data as unknown as Record<string, unknown> | null;
        setTimerState((row?.disappear_timer as DisappearTimer) || 'off');
      });
  }, [conversationId, table]);

  const setTimer = useCallback(async (newTimer: DisappearTimer) => {
    if (!conversationId) return;
    await (supabase.from(table) as unknown as {
      update: (v: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<unknown> };
    }).update({ disappear_timer: newTimer }).eq('id', conversationId);
    setTimerState(newTimer);
  }, [conversationId, table]);

  const getExpiresAt = useCallback((timer: DisappearTimer): string | null => {
    if (timer === 'off') return null;
    return new Date(Date.now() + TIMER_MS[timer]).toISOString();
  }, []);

  const isExpired = useCallback((expiresAt: string | null): boolean => {
    if (!expiresAt) return false;
    return new Date(expiresAt).getTime() < Date.now();
  }, []);

  return { timer, setTimer, getExpiresAt, isExpired };
}