import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Conversation } from '../types';

export function useConversations(userId: string | undefined) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const profilesCacheRef = useRef<Record<string, any>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!userId) { setConversations([]); setLoading(false); return; }

    const { data, error } = await (supabase
      .from('conversations' as any)
      .select('*')
      .or(`user_1.eq.${userId},user_2.eq.${userId}`)
      .order('last_message_at', { ascending: false }) as any);

    if (!error && data) {
      // Only fetch profiles we don't have cached
      const otherUserIds = data.map((c: any) => c.user_1 === userId ? c.user_2 : c.user_1);
      const uniqueIds = [...new Set(otherUserIds)] as string[];
      const uncachedIds = uniqueIds.filter(id => !profilesCacheRef.current[id]);

      if (uncachedIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, username')
          .in('id', uncachedIds);

        profiles?.forEach((p: any) => {
          profilesCacheRef.current[p.id] = {
            id: p.id,
            full_name: p.full_name,
            avatar_url: p.avatar_url,
            username: p.username,
          };
        });
      }

      // Count unread — only for THIS user's conversations
      const conversationIds = data.map((c: any) => c.id);
      const { data: unreadCounts } = await (supabase
        .from('private_messages' as any)
        .select('conversation_id')
        .in('conversation_id', conversationIds)
        .eq('is_read', false)
        .neq('sender_id', userId) as any);

      const unreadMap: Record<string, number> = {};
      (unreadCounts || []).forEach((m: any) => {
        unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] || 0) + 1;
      });

      const enriched: Conversation[] = data.map((c: any) => {
        const otherId = c.user_1 === userId ? c.user_2 : c.user_1;
        return {
          ...c,
          other_user: profilesCacheRef.current[otherId] || { id: otherId },
          unread_count: unreadMap[c.id] || 0,
        };
      });

      setConversations(enriched);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // ─── Realtime: Only listen to THIS USER's conversations ───
  useEffect(() => {
    if (!userId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`conversations-${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'private_chats',
        // Filter: only conversations where this user is a participant
        // Supabase doesn't support OR in filters, so we listen to all
        // but debounce the refetch
      }, (payload) => {
        const updated = payload.new as any;
        // Only refetch if this user is a participant
        if (updated.user_1 === userId || updated.user_2 === userId) {
          // Update inline instead of full refetch
          setConversations(prev => {
            const existing = prev.find(c => c.id === updated.id);
            if (existing) {
              return prev
                .map(c => c.id === updated.id
                  ? { ...c, last_message: updated.last_message, last_message_at: updated.last_message_at }
                  : c
                )
                .sort((a, b) =>
                  new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
                );
            }
            // New conversation — do a full fetch
            fetchConversations();
            return prev;
          });
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'private_chats',
      }, (payload) => {
        const newConvo = payload.new as any;
        if (newConvo.user_1 === userId || newConvo.user_2 === userId) {
          fetchConversations(); // Full fetch for new conversations (need profile data)
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Conversations] ✅ Realtime connected');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, fetchConversations]);

  // ─── Listen for unread count changes via new messages ───
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`unread-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'private_messages',
      }, (payload) => {
        const msg = payload.new as any;
        // Only count messages TO this user
        if (msg.sender_id === userId) return;

        // Increment unread count for this conversation
        setConversations(prev =>
          prev.map(c => c.id === msg.conversation_id
            ? { ...c, unread_count: (c.unread_count || 0) + 1 }
            : c
          )
        );
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  return { conversations, loading, refetch: fetchConversations };
}