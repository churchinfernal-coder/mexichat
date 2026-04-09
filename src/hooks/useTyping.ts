/**
 * MEXICHAT - Enhanced Typing Indicator v2.0
 * Supports activity types: typing, recording, location, uploading
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ActivityType = 'typing' | 'recording' | 'location' | 'uploading';

interface ActivityPayload {
  userId: string;
  activity: ActivityType;
}

interface UseTypingOptions {
  conversationId: string;
  currentUserId: string;
  otherUserId: string;
}

export function useTyping({ conversationId, currentUserId, otherUserId }: UseTypingOptions) {
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [otherActivity, setOtherActivity] = useState<ActivityType>('typing');
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  useEffect(() => {
    const channel = supabase.channel('typing:' + conversationId);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'typing' }, ({ payload }: { payload: ActivityPayload }) => {
        if (payload.userId === otherUserId) {
          setIsOtherTyping(true);
          setOtherActivity(payload.activity || 'typing');
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setIsOtherTyping(false), 3000);
        }
      })
      .on('broadcast', { event: 'stop-typing' }, ({ payload }: { payload: Record<string, unknown> }) => {
        if (payload.userId === otherUserId) {
          setIsOtherTyping(false);
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [conversationId, otherUserId]);

  const sendActivity = useCallback((activity: ActivityType = 'typing') => {
    const now = Date.now();
    if (now - lastTypingSent.current < 2000) return;
    lastTypingSent.current = now;
    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUserId, activity } as ActivityPayload,
    });
  }, [currentUserId]);

  const sendTyping = useCallback(() => sendActivity('typing'), [sendActivity]);
  const sendRecording = useCallback(() => sendActivity('recording'), [sendActivity]);
  const sendLocation = useCallback(() => sendActivity('location'), [sendActivity]);
  const sendUploading = useCallback(() => sendActivity('uploading'), [sendActivity]);

  const sendStopTyping = useCallback(() => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'stop-typing',
      payload: { userId: currentUserId },
    });
  }, [currentUserId]);

  return {
    isOtherTyping,
    otherActivity,
    sendTyping,
    sendRecording,
    sendLocation,
    sendUploading,
    sendStopTyping,
  };
}