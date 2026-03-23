import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Reaction {
  emoji: string;
  count: number;
  users: string[];
  hasReacted: boolean;
}

export interface MessageReactions {
  [messageId: string]: Reaction[];
}

export function useMessageReactions(
  currentUserId: string | undefined,
  messageTable: 'private_messages' | 'group_messages',
  scopeId: string | null, // conversationId or groupId
) {
  const [reactions, setReactions] = useState<MessageReactions>({});

  const loadReactions = useCallback(async (messageIds: string[]) => {
    if (!messageIds.length || !currentUserId) return;

    const { data } = await supabase.from('message_reactions')
      .select('id, message_id, user_id, emoji')
      .in('message_id', messageIds);

    if (!data) return;

    const grouped: MessageReactions = {};
    for (const row of data) {
      const r = row as Record<string, unknown>;
      const msgId = String(r.message_id);
      const emoji = String(r.emoji);
      const userId = String(r.user_id);

      if (!grouped[msgId]) grouped[msgId] = [];
      const existing = grouped[msgId].find(rx => rx.emoji === emoji);
      if (existing) {
        existing.count++;
        existing.users.push(userId);
        if (userId === currentUserId) existing.hasReacted = true;
      } else {
        grouped[msgId].push({
          emoji,
          count: 1,
          users: [userId],
          hasReacted: userId === currentUserId,
        });
      }
    }

    setReactions(prev => ({ ...prev, ...grouped }));
  }, [currentUserId]);

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!currentUserId) return;

    const existing = reactions[messageId]?.find(r => r.emoji === emoji && r.hasReacted);
    if (existing) {
      // Remove reaction
      await supabase.from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', currentUserId)
        .eq('emoji', emoji);

      setReactions(prev => {
        const msgReactions = (prev[messageId] || []).map(r => {
          if (r.emoji !== emoji) return r;
          const newUsers = r.users.filter(u => u !== currentUserId);
          return { ...r, count: Math.max(0, r.count - 1), users: newUsers, hasReacted: false };
        }).filter(r => r.count > 0);
        return { ...prev, [messageId]: msgReactions };
      });
    } else {
      // Add reaction
      await supabase.from('message_reactions').insert({
        message_id: messageId,
        user_id: currentUserId,
        emoji,
        message_table: messageTable,
      });

      setReactions(prev => {
        const msgReactions = [...(prev[messageId] || [])];
        const idx = msgReactions.findIndex(r => r.emoji === emoji);
        if (idx >= 0) {
          msgReactions[idx] = {
            ...msgReactions[idx],
            count: msgReactions[idx].count + 1,
            users: [...msgReactions[idx].users, currentUserId],
            hasReacted: true,
          };
        } else {
          msgReactions.push({ emoji, count: 1, users: [currentUserId], hasReacted: true });
        }
        return { ...prev, [messageId]: msgReactions };
      });
    }
  }, [currentUserId, reactions, messageTable]);

  // Realtime subscription
  useEffect(() => {
    if (!scopeId) return;
    const channel = supabase.channel(`reactions:${scopeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const r = payload.new as Record<string, unknown>;
          const msgId = String(r.message_id);
          const emoji = String(r.emoji);
          const userId = String(r.user_id);
          if (userId === currentUserId) return; // Already handled optimistically
          setReactions(prev => {
            const msgReactions = [...(prev[msgId] || [])];
            const idx = msgReactions.findIndex(rx => rx.emoji === emoji);
            if (idx >= 0) {
              msgReactions[idx] = { ...msgReactions[idx], count: msgReactions[idx].count + 1, users: [...msgReactions[idx].users, userId] };
            } else {
              msgReactions.push({ emoji, count: 1, users: [userId], hasReacted: false });
            }
            return { ...prev, [msgId]: msgReactions };
          });
        }
        if (payload.eventType === 'DELETE') {
          const r = payload.old as Record<string, unknown>;
          const msgId = String(r.message_id);
          const emoji = String(r.emoji);
          const userId = String(r.user_id);
          if (userId === currentUserId) return;
          setReactions(prev => {
            const msgReactions = (prev[msgId] || []).map(rx => {
              if (rx.emoji !== emoji) return rx;
              return { ...rx, count: Math.max(0, rx.count - 1), users: rx.users.filter(u => u !== userId) };
            }).filter(rx => rx.count > 0);
            return { ...prev, [msgId]: msgReactions };
          });
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [scopeId, currentUserId]);

  return { reactions, loadReactions, toggleReaction };
}