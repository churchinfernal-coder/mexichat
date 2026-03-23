/**
 * useCallSession — Persists calls to call_sessions table
 * Checks blocked_users and busy status before allowing calls
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

type CallType = 'audio' | 'video';

interface CallPermission {
  allowed: boolean;
  reason: string | null;
}

interface CallSessionRecord {
  id: string;
  call_type: CallType;
  status: string;
  caller_id: string;
  callee_id: string;
  conversation_id: string | null;
  room_id: string | null;
  initiated_at: string;
}

export function useCallSession() {
  /**
   * Check if a call is allowed (not blocked, not busy)
   */
  const checkPermission = useCallback(async (
    callerId: string,
    calleeId: string
  ): Promise<CallPermission> => {
    try {
      const { data, error } = await supabase.rpc('can_user_call', {
        p_caller_id: callerId,
        p_callee_id: calleeId,
      });

      if (error) {
        console.error('[useCallSession] Permission check failed:', error);
        // Fallback: allow call but log error
        return { allowed: true, reason: null };
      }

      return {
        allowed: (data as any)?.allowed ?? true,
        reason: (data as any)?.reason ?? null,
      };
    } catch (err) {
      console.error('[useCallSession] Permission check error:', err);
      return { allowed: true, reason: null };
    }
  }, []);

  /**
   * Create a call_sessions record when initiating a call
   */
  const createSession = useCallback(async (
    callerId: string,
    calleeId: string,
    callType: CallType,
    conversationId: string | null,
    roomId: string
  ): Promise<CallSessionRecord | null> => {
    try {
      const { data, error } = await supabase
        .from('call_sessions')
        .insert({
          call_type: callType,
          status: 'initiated',
          caller_id: callerId,
          callee_id: calleeId,
          conversation_id: conversationId,
          room_id: roomId,
        } as any)
        .select('*')
        .single();

      if (error) {
        console.error('[useCallSession] Create session failed:', error);
        return null;
      }

      console.log('[useCallSession] ✅ Session created:', data?.id);
      return data as unknown as CallSessionRecord;
    } catch (err) {
      console.error('[useCallSession] Create session error:', err);
      return null;
    }
  }, []);

  /**
   * Update call status (ringing, accepted, in_progress, etc.)
   */
  const updateStatus = useCallback(async (
    sessionId: string,
    status: string,
    extra?: Record<string, unknown>
  ) => {
    try {
      const updatePayload: Record<string, unknown> = { status };

      if (status === 'ringing') updatePayload.ringing_at = new Date().toISOString();
      if (status === 'accepted' || status === 'in_progress') updatePayload.accepted_at = new Date().toISOString();

      if (extra) Object.assign(updatePayload, extra);

      await supabase
        .from('call_sessions')
        .update(updatePayload as any)
        .eq('id', sessionId);

      console.log(`[useCallSession] Status → ${status}`);
    } catch (err) {
      console.error('[useCallSession] Update status error:', err);
    }
  }, []);

  /**
   * End a call — calculates duration and sets end reason
   */
  const endSession = useCallback(async (
    sessionId: string,
    endedBy: string,
    reason: string = 'caller_hangup'
  ) => {
    try {
      // First get the session to calculate duration
      const { data: session } = await supabase
        .from('call_sessions')
        .select('accepted_at, initiated_at, status')
        .eq('id', sessionId)
        .single();

      if (!session) return;

      // Don't update already-ended sessions
      if ((session as any).status === 'ended' || (session as any).status === 'failed') return;

      const startTime = (session as any).accepted_at || (session as any).initiated_at;
      const duration = startTime
        ? Math.floor((Date.now() - new Date(startTime).getTime()) / 1000)
        : 0;

      await supabase
        .from('call_sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          ended_by: endedBy,
          end_reason: reason,
          duration_seconds: duration,
        } as any)
        .eq('id', sessionId);

      console.log(`[useCallSession] ✅ Session ended — duration: ${duration}s`);
    } catch (err) {
      console.error('[useCallSession] End session error:', err);
    }
  }, []);

  /**
   * Mark a missed call
   */
  const markMissed = useCallback(async (sessionId: string) => {
    try {
      await supabase
        .from('call_sessions')
        .update({
          status: 'missed',
          ended_at: new Date().toISOString(),
          end_reason: 'timeout',
        } as any)
        .eq('id', sessionId);
    } catch (err) {
      console.error('[useCallSession] Mark missed error:', err);
    }
  }, []);

  /**
   * Mark declined
   */
  const markDeclined = useCallback(async (sessionId: string, declinedBy: string) => {
    try {
      await supabase
        .from('call_sessions')
        .update({
          status: 'declined',
          ended_at: new Date().toISOString(),
          ended_by: declinedBy,
          end_reason: 'declined',
        } as any)
        .eq('id', sessionId);
    } catch (err) {
      console.error('[useCallSession] Mark declined error:', err);
    }
  }, []);

  /**
   * Get call history for current user
   */
  const getHistory = useCallback(async (userId: string, limit: number = 50) => {
    try {
      const { data, error } = await supabase.rpc('get_my_call_history', {
        p_user_id: userId,
        p_limit: limit,
      });

      if (error) {
        console.error('[useCallSession] Get history error:', error);
        return [];
      }

      return data ?? [];
    } catch (err) {
      console.error('[useCallSession] Get history error:', err);
      return [];
    }
  }, []);

  return {
    checkPermission,
    createSession,
    updateStatus,
    endSession,
    markMissed,
    markDeclined,
    getHistory,
  };
}