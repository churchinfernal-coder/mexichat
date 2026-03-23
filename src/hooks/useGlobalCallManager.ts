/**
 * useGlobalCallManager v3
 *
 * SOLE OWNER of:
 *   - webrtc-service callbacks (onCallRequest, onCallAccept, etc.)
 *   - Incoming call signals via call-signal:{userId} channel
 *   - CallContext state management
 *   - DB persistence via useCallSession
 *   - Ringtone
 *   - Push notifications (calls + missed calls)
 *
 * Used ONCE in App.tsx via <CallManager> — never duplicated.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCallContext, type IncomingCallSignal } from '@/contexts/CallContext';
import { useCallSession } from '@/hooks/useCallSession';
import { webRTCService } from '@/lib/webrtc-service';
import { supabase } from '@/integrations/supabase/client';
import { startRingtone, stopRingtone } from '@/utils/sounds';
import { sendPushNotification } from '@/utils/pushNotify';

// ═══════════════════════════════════════════════════════════════════════════
// BROWSER NOTIFICATION HELPER
// ═══════════════════════════════════════════════════════════════════════════

function showCallNotification(callerName: string, callType: 'audio' | 'video', conversationId: string, from: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.hasFocus()) return;

  try {
    const n = new Notification(`📞 ${callerName}`, {
      body: callType === 'video' ? 'Videollamada entrante...' : 'Llamada de voz entrante...',
      icon: '/web-app-manifest-192x192.png',
      badge: '/favicon-96x96.png',
      tag: 'mc-incoming-call',
      silent: false,
      requireInteraction: true,
    });

    n.onclick = () => {
      window.focus();
      n.close();
      window.dispatchEvent(new CustomEvent('mc-navigate-conversation', {
        detail: { conversationId, fromUserId: from },
      }));
    };
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useGlobalCallManager() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const {
    incomingCall,
    setIncomingCall,
    clearIncomingCall,
    activeCall,
    setActiveCall,
    updateActiveCall,
    isProcessingCall,
  } = useCallContext();

  const callSession = useCallSession();
  const activeCallRef = useRef(activeCall);
  activeCallRef.current = activeCall;

  const incomingCallRef = useRef(incomingCall);
  incomingCallRef.current = incomingCall;

  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Helpers ───
  const startDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    durationIntervalRef.current = setInterval(() => {
      updateActiveCall({
        duration: (activeCallRef.current?.duration ?? 0) + 1,
      });
    }, 1000);
  }, [updateActiveCall]);

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  const clearCallTimeout = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
  }, []);

  // ─── Initialize WebRTC service ───
  useEffect(() => {
    if (!userId) return;
    webRTCService.ensureInitialized().catch(err => {
      console.error('[GlobalCallManager] WebRTC init failed:', err);
    });
  }, [userId]);

  // ─── SOLE call-signal listener (replaces NotificationProvider's) ───
  useEffect(() => {
    if (!userId) return;

    const channelName = `call-signal:${userId}`;
    const channel = supabase.channel(channelName);

    channel
      .on('broadcast', { event: 'incoming-call' }, ({ payload }: { payload: Record<string, unknown> }) => {
        if (payload.to !== userId) return;

        // Guard: already have incoming or active call
        if (incomingCallRef.current) return;
        if (activeCallRef.current?.active) return;
        if (isProcessingCall.current) return;

        const from = payload.from as string;
        const callerName = (payload.callerName as string) || 'Llamada entrante';
        const callType = (payload.callType as 'audio' | 'video') || 'audio';
        const conversationId = (payload.conversationId as string) || '';

        if (!from) return;

        console.log('[GlobalCallManager] 📞 Incoming call signal from:', from);

        // If webRTCService.onCallRequest hasn't fired within 2s, use this signal
        // as fallback to show the call overlay + ringtone. This handles the case
        // where the WebRTC broadcast was missed (tab sleeping, network hiccup).
        setTimeout(() => {
          // If onCallRequest already handled it, bail out
          if (incomingCallRef.current) return;
          if (activeCallRef.current?.active) return;
          if (isProcessingCall.current) return;

          console.log('[GlobalCallManager] 📞 Using call-signal as fallback (WebRTC broadcast missed)');
          window.dispatchEvent(new CustomEvent('mc-native-incoming-call', {
            detail: {
              callerId: from,
              callerName,
              callType,
              conversationId,
            },
          }));
        }, 2000);

        showCallNotification(callerName, callType, conversationId, from);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[GlobalCallManager] Call signal channel ready: ${channelName}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, isProcessingCall]);

  // ─── Wire WebRTC service callbacks ───
  useEffect(() => {
    if (!userId) return;

    // INCOMING CALL REQUEST (via webrtc:global broadcast)
    webRTCService.onCallRequest = async (from: string, callId: string, callType: 'audio' | 'video') => {
      console.log('[GlobalCallManager] 📞 Incoming call-request from:', from, 'callId:', callId);

      if (isProcessingCall.current) {
        console.log('[GlobalCallManager] Already processing a call, ignoring');
        return;
      }
      if (activeCallRef.current?.active) {
        console.log('[GlobalCallManager] Already in call, auto-rejecting');
        webRTCService.rejectCall(callId);
        isProcessingCall.current = false;
        return;
      }

      isProcessingCall.current = true;

      // Fetch caller profile
      let callerName = 'Usuario';
      let callerAvatar: string | null = null;
      let conversationId = '';

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', from)
          .single();

        if (profile) {
          callerName = (profile as any).full_name || 'Usuario';
          callerAvatar = (profile as any).avatar_url || null;
        }

        const { data: conv } = await supabase
          .from('conversations')
          .select('id')
          .or(`and(user_1.eq.${userId},user_2.eq.${from}),and(user_1.eq.${from},user_2.eq.${userId})`)
          .maybeSingle();

        conversationId = conv?.id ?? '';
      } catch (err) {
        console.warn('[GlobalCallManager] Profile fetch error:', err);
      }

      const signal: IncomingCallSignal = {
        from,
        callerName,
        callType,
        conversationId,
        callId,
        sessionId: null,
        avatarUrl: callerAvatar,
        receivedAt: Date.now(),
      };

      setIncomingCall(signal);
      startRingtone('incoming');
      showCallNotification(callerName, callType, conversationId, from);

      // Auto-miss after 45 seconds
      clearCallTimeout();
      callTimeoutRef.current = setTimeout(() => {
        console.log('[GlobalCallManager] Call timeout — marking missed');
        if (incomingCallRef.current?.callId === callId) {
          webRTCService.rejectCall(callId);
          clearIncomingCall();
          stopRingtone();
        }
      }, 45000);
    };

    // CALL ACCEPTED (I'm the caller, other side accepted)
    webRTCService.onCallAccept = (callId: string) => {
      console.log('[GlobalCallManager] ✅ Call accepted by other side');
      stopRingtone();
      if (activeCallRef.current) {
        updateActiveCall({ status: 'connected' });
        if (activeCallRef.current.sessionId) {
          callSession.updateStatus(activeCallRef.current.sessionId, 'in_progress');
        }
        startDurationTimer();
      }
    };

    // CALL REJECTED
    webRTCService.onCallReject = (callId: string) => {
      console.log('[GlobalCallManager] ❌ Call rejected');
      stopRingtone();
      clearCallTimeout();
      stopDurationTimer();

      if (activeCallRef.current?.sessionId) {
        callSession.markDeclined(activeCallRef.current.sessionId, activeCallRef.current.peerId);
      }

      updateActiveCall({ status: 'ended', active: false });
      setTimeout(() => setActiveCall(null), 2000);
    };

    // CALL ENDED BY OTHER SIDE
    webRTCService.onCallEnd = (callId: string) => {
      console.log('[GlobalCallManager] 📞 Call ended by other side, callId:', callId);
      stopRingtone();
      clearCallTimeout();
      stopDurationTimer();

      // If this is for an incoming call that hasn't been answered yet, just clear it
      if (incomingCallRef.current?.callId === callId) {
        console.log('[GlobalCallManager] Incoming call cancelled by caller');
        clearIncomingCall();
        return;
      }

      if (activeCallRef.current?.sessionId) {
        callSession.endSession(
          activeCallRef.current.sessionId,
          activeCallRef.current.peerId,
          'callee_hangup'
        );
      }

      if (activeCallRef.current?.active) {
        updateActiveCall({ status: 'ended', active: false });
        setTimeout(() => setActiveCall(null), 2000);
      }
    };

    // REMOTE STREAM READY
    webRTCService.onRemoteStream = (stream: MediaStream, callId?: string) => {
      console.log('[GlobalCallManager] 📺 Remote stream received');
      if (activeCallRef.current && activeCallRef.current.status !== 'connected') {
        updateActiveCall({ status: 'connected' });
        startDurationTimer();
      }
    };

    // CONNECTION STATE CHANGES
    webRTCService.onCallStateChange = (state: string, callId?: string) => {
      console.log('[GlobalCallManager] 🔌 Connection state:', state);
      if (state === 'connected') {
        stopRingtone();
        if (activeCallRef.current && activeCallRef.current.status !== 'connected') {
          updateActiveCall({ status: 'connected' });
          startDurationTimer();
        }
      } else if (state === 'failed' || state === 'closed') {
        stopRingtone();
        stopDurationTimer();
        if (activeCallRef.current?.active) {
          if (activeCallRef.current.sessionId) {
            callSession.endSession(
              activeCallRef.current.sessionId,
              userId!,
              state === 'failed' ? 'network_error' : 'caller_hangup'
            );
          }
          updateActiveCall({ status: 'ended', active: false });
          setTimeout(() => setActiveCall(null), 2000);
        }
      }
    };

    webRTCService.onError = (err: any) => {
      console.error('[GlobalCallManager] WebRTC error:', err);
    };

    return () => {
      webRTCService.onCallRequest = null;
      webRTCService.onCallAccept = null;
      webRTCService.onCallReject = null;
      webRTCService.onCallEnd = null;
      webRTCService.onRemoteStream = null;
      webRTCService.onCallStateChange = null;
      webRTCService.onError = null;
      stopRingtone();
      clearCallTimeout();
      stopDurationTimer();
    };
  }, [userId, setIncomingCall, clearIncomingCall, setActiveCall, updateActiveCall, callSession, isProcessingCall, startDurationTimer, stopDurationTimer, clearCallTimeout]);

  // ─── PUSH/SW Wake: Handle mc-native-incoming-call + mc-reject-incoming-call ───
  // When the app is asleep and a push notification wakes the SW (or Capacitor push),
  // the event mc-native-incoming-call is dispatched on window. We MUST handle it here
  // to show the in-app call overlay and play the ringtone. Without this, the receiver
  // only gets a silent system notification with no in-app UI.
  useEffect(() => {
    if (!userId) return;

    const handlePushIncomingCall = async (evt: Event) => {
      const detail = (evt as CustomEvent).detail;
      if (!detail?.callerId) return;

      // Guard: already in a call or processing
      if (incomingCallRef.current) return;
      if (activeCallRef.current?.active) return;
      if (isProcessingCall.current) return;

      isProcessingCall.current = true;

      const callerId = detail.callerId as string;
      const callerName = (detail.callerName as string) || 'Llamada entrante';
      const callType = (detail.callType as 'audio' | 'video') || 'audio';
      const conversationId = (detail.conversationId as string) || '';

      console.log('[GlobalCallManager] 📞 Push wake incoming call from:', callerId);

      // Fetch caller profile for avatar
      let avatarUrl: string | null = null;
      let resolvedName = callerName;
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', callerId)
          .single();
        if (profile) {
          resolvedName = (profile as any).full_name || callerName;
          avatarUrl = (profile as any).avatar_url || null;
        }
      } catch {}

      const signal: IncomingCallSignal = {
        from: callerId,
        callerName: resolvedName,
        callType,
        conversationId,
        callId: `push-${callerId}-${Date.now()}`,
        sessionId: null,
        avatarUrl,
        receivedAt: Date.now(),
      };

      setIncomingCall(signal);
      startRingtone('incoming');

      // Auto-miss after 45 seconds
      clearCallTimeout();
      callTimeoutRef.current = setTimeout(() => {
        if (incomingCallRef.current?.from === callerId) {
          clearIncomingCall();
          stopRingtone();
        }
      }, 45000);
    };

    const handlePushRejectCall = (evt: Event) => {
      const detail = (evt as CustomEvent).detail;
      if (!detail?.fromUserId) return;

      console.log('[GlobalCallManager] ❌ Push reject call from:', detail.fromUserId);

      // If we have an incoming call from this caller, reject it
      if (incomingCallRef.current?.from === detail.fromUserId) {
        stopRingtone();
        clearCallTimeout();
        if (incomingCallRef.current.callId) {
          webRTCService.rejectCall(incomingCallRef.current.callId);
        }
        if (incomingCallRef.current.sessionId) {
          callSession.markDeclined(incomingCallRef.current.sessionId, userId);
        }
        clearIncomingCall();
      }
    };

    const handleNavigateConversation = (evt: Event) => {
      const detail = (evt as CustomEvent).detail;
      if (!detail) return;

      // If autoAcceptCall and we have a matching incoming call, accept it
      if (detail.autoAcceptCall && incomingCallRef.current) {
        console.log('[GlobalCallManager] Auto-accepting call from push notification');
        // The acceptCall function will be called by whoever renders the overlay
        // but we can trigger it via the existing incoming call state
      }
    };

    window.addEventListener('mc-native-incoming-call', handlePushIncomingCall);
    window.addEventListener('mc-reject-incoming-call', handlePushRejectCall);
    window.addEventListener('mc-navigate-conversation', handleNavigateConversation);

    return () => {
      window.removeEventListener('mc-native-incoming-call', handlePushIncomingCall);
      window.removeEventListener('mc-reject-incoming-call', handlePushRejectCall);
      window.removeEventListener('mc-navigate-conversation', handleNavigateConversation);
    };
  }, [userId, setIncomingCall, clearIncomingCall, callSession, isProcessingCall, clearCallTimeout]);

  // ─── PUBLIC API: Initiate Call ───
  const initiateCall = useCallback(async (
    targetUserId: string,
    callType: 'audio' | 'video',
    conversationId: string
  ) => {
    if (!userId) return;

    const permission = await callSession.checkPermission(userId, targetUserId);
    if (!permission.allowed) {
      const messages: Record<string, string> = {
        blocked: 'No puedes llamar a este usuario',
        busy: 'El usuario está en otra llamada',
        already_in_call: 'Ya estás en una llamada',
      };
      throw new Error(messages[permission.reason!] || 'No se puede realizar la llamada');
    }

    const { localStream, callId } = await webRTCService.initiateCall(targetUserId, callType);

    const session = await callSession.createSession(
      userId, targetUserId, callType, conversationId, callId
    );

    setActiveCall({
      active: true,
      type: callType,
      status: 'calling',
      duration: 0,
      isMuted: false,
      isVideoOff: false,
      peerId: targetUserId,
      conversationId,
      callId,
      sessionId: session?.id ?? null,
    });

    // Play outgoing ringback tone while waiting for answer
    startRingtone('outgoing');

    // ═══ BROADCAST: Send call signal via Supabase realtime (backup for WebRTC) ═══
    // This ensures the receiver gets the call even if webrtc:global broadcast is missed
    try {
      const signalChannel = supabase.channel(`call-signal:${targetUserId}`);
      await signalChannel.subscribe();

      const myProfile = await supabase.from('profiles').select('full_name, avatar_url').eq('id', userId).single();

      await signalChannel.send({
        type: 'broadcast',
        event: 'incoming-call',
        payload: {
          from: userId,
          to: targetUserId,
          callerName: (myProfile.data as any)?.full_name || 'Llamada entrante',
          callType,
          conversationId,
          callId,
          avatarUrl: (myProfile.data as any)?.avatar_url || null,
        },
      });

      // Clean up this temporary channel after a short delay
      setTimeout(() => supabase.removeChannel(signalChannel), 5000);
    } catch (err) {
      console.warn('[GlobalCallManager] Call signal broadcast failed:', err);
    }

    // ═══ PUSH NOTIFICATION: Wake up receiver's phone even if app is closed ═══
    supabase.from('profiles').select('full_name, avatar_url').eq('id', userId).single()
      .then(({ data: myProfile }) => {
        sendPushNotification({
          targetUserId,
          type: 'call',
          title: (myProfile as any)?.full_name || 'Llamada entrante',
          body: callType === 'video' ? '📹 Videollamada entrante...' : '📞 Llamada de voz entrante...',
          fromUserId: userId,
          conversationId,
          callType,
          avatarUrl: (myProfile as any)?.avatar_url || null,
        }).catch(() => {}); // Push is best-effort — don't block the call
      });

    // Auto-cancel after 45 seconds if no answer
    callTimeoutRef.current = setTimeout(async () => {
      if (activeCallRef.current?.status === 'calling' && activeCallRef.current?.callId === callId) {
        console.log('[GlobalCallManager] Call timeout — no answer');
        stopRingtone();
        await webRTCService.endCall(callId);
        if (session?.id) {
          await callSession.markMissed(session.id);
        }
        updateActiveCall({ status: 'ended', active: false });
        setTimeout(() => setActiveCall(null), 2000);

        // ═══ PUSH: Send missed call notification ═══
        supabase.from('profiles').select('full_name, avatar_url').eq('id', userId).single()
          .then(({ data: myProfile }) => {
            sendPushNotification({
              targetUserId,
              type: 'message',
              title: 'Llamada perdida',
              body: `${(myProfile as any)?.full_name || 'Alguien'} intentó ${callType === 'video' ? 'videollamarte' : 'llamarte'}`,
              fromUserId: userId,
              conversationId,
              avatarUrl: (myProfile as any)?.avatar_url || null,
            }).catch(() => {});
          });
      }
    }, 45000);

    return { localStream, callId };
  }, [userId, callSession, setActiveCall, updateActiveCall]);

  // ─── PUBLIC API: Accept Incoming Call ───
  const acceptCall = useCallback(async (incoming: IncomingCallSignal) => {
    if (!userId) return;

    console.log('[GlobalCallManager] ✅ Accepting call:', incoming.callId);

    stopRingtone();
    clearCallTimeout();

    try {
      const localStream = await webRTCService.acceptCall(incoming.callId, incoming.callType);
      console.log('[GlobalCallManager] ✅ WebRTC acceptCall succeeded');

      setActiveCall({
        active: true,
        type: incoming.callType,
        status: 'ringing',
        duration: 0,
        isMuted: false,
        isVideoOff: false,
        peerId: incoming.from,
        conversationId: incoming.conversationId,
        callId: incoming.callId,
        sessionId: incoming.sessionId,
      });

      clearIncomingCall();

      return localStream;
    } catch (err) {
      console.error('[GlobalCallManager] Accept call failed:', err);
      clearIncomingCall();
      throw err;
    }
  }, [userId, setActiveCall, clearIncomingCall, clearCallTimeout]);

  // ─── PUBLIC API: Reject Incoming Call ───
  const rejectCall = useCallback(async (incoming: IncomingCallSignal) => {
    if (!userId) return;

    console.log('[GlobalCallManager] ❌ Rejecting call:', incoming.callId);

    stopRingtone();
    clearCallTimeout();

    webRTCService.rejectCall(incoming.callId);

    if (incoming.sessionId) {
      await callSession.markDeclined(incoming.sessionId, userId);
    }

    clearIncomingCall();
  }, [userId, callSession, clearIncomingCall, clearCallTimeout]);

  // ─── PUBLIC API: End Active Call ───
  const endActiveCall = useCallback(async () => {
    if (!userId || !activeCallRef.current) return;

    const current = activeCallRef.current;
    console.log('[GlobalCallManager] 🔚 Ending active call:', current.callId);

    stopRingtone();
    clearCallTimeout();
    stopDurationTimer();

    await webRTCService.endCall(current.callId);

    if (current.sessionId) {
      await callSession.endSession(current.sessionId, userId, 'caller_hangup');
    }

    updateActiveCall({ status: 'ended', active: false });
    setTimeout(() => setActiveCall(null), 2000);
  }, [userId, callSession, updateActiveCall, setActiveCall, stopDurationTimer, clearCallTimeout]);

  // ─── PUBLIC API: Toggle Audio ───
  const toggleMute = useCallback(() => {
    if (!activeCallRef.current) return;
    const newMuted = !activeCallRef.current.isMuted;
    webRTCService.toggleAudio(!newMuted, activeCallRef.current.callId);
    updateActiveCall({ isMuted: newMuted });
  }, [updateActiveCall]);

  // ─── PUBLIC API: Toggle Video ───
  const toggleVideo = useCallback(() => {
    if (!activeCallRef.current) return;
    const newOff = !activeCallRef.current.isVideoOff;
    webRTCService.toggleVideo(!newOff, activeCallRef.current.callId);
    updateActiveCall({ isVideoOff: newOff });
  }, [updateActiveCall]);

  return {
    initiateCall,
    acceptCall,
    rejectCall,
    endActiveCall,
    toggleMute,
    toggleVideo,
  };
}