import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseTypingOptions {
  conversationId: string;
  currentUserId: string;
  otherUserId: string;
}

export function useTyping({ conversationId, currentUserId, otherUserId }: UseTypingOptions) {
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  useEffect(() => {
    const channel = supabase.channel(`typing:${conversationId}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'typing' }, ({ payload }: { payload: Record<string, unknown> }) => {
        if (payload.userId === otherUserId) {
          setIsOtherTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setIsOtherTyping(false), 3000);
        }
      })
      .on('broadcast', { event: 'stop-typing' }, ({ payload }: { payload: Record<string, unknown> }) => {
        if (payload.userId === otherUserId) {
          setIsOtherTyping(false);
          if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [conversationId, otherUserId]);

  const sendTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current < 2000) return;
    lastTypingSent.current = now;
    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUserId },
    });
  }, [currentUserId]);

  const sendStopTyping = useCallback(() => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'stop-typing',
      payload: { userId: currentUserId },
    });
  }, [currentUserId]);

  return { isOtherTyping, sendTyping, sendStopTyping };
}