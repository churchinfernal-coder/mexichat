import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type DeliveryState = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface DeliveryStatus {
  [messageId: string]: DeliveryState;
}

export function useDeliveryStatus(
  conversationId: string | null,
  currentUserId: string | undefined,
) {
  const [statuses, setStatuses] = useState<DeliveryStatus>({});

  const setStatus = useCallback((messageId: string, status: DeliveryState) => {
    setStatuses(prev => ({ ...prev, [messageId]: status }));
  }, []);

  const markSending = useCallback((messageId: string) => setStatus(messageId, 'sending'), [setStatus]);
  const markSent = useCallback((messageId: string) => setStatus(messageId, 'sent'), [setStatus]);
  const markFailed = useCallback((messageId: string) => setStatus(messageId, 'failed'), [setStatus]);

  // Listen for read status updates
  useEffect(() => {
    if (!conversationId || !currentUserId) return;
    const channel = supabase.channel(`delivery:${conversationId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'private_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const row = payload.new as Record<string, unknown>;
        if (String(row.sender_id) !== currentUserId) return;
        const msgId = String(row.id);
        if (row.is_read === true) setStatus(msgId, 'read');
        else if (row.delivered_at) setStatus(msgId, 'delivered');
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, currentUserId, setStatus]);

  const getStatus = useCallback((messageId: string, isRead?: boolean): DeliveryState => {
    if (statuses[messageId]) return statuses[messageId];
    if (isRead) return 'read';
    return 'sent';
  }, [statuses]);

  return { statuses, getStatus, markSending, markSent, markFailed };
}