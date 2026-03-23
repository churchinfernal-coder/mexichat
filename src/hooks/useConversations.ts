import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  type ProfileRow,
  type ConversationItem,
  mapConversation,
} from '@/utils/messageMappers';

export function useConversations(
  myUserId: string | undefined,
  blockedIds: Set<string>
) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const profilesRef = useRef(new Map<string, ProfileRow>());

  const load = useCallback(async () => {
    if (!myUserId) return;
    setLoading(true);

    const { data: convRows } = await supabase
      .from('conversations')
      .select('*')
      .or(`user_1.eq.${myUserId},user_2.eq.${myUserId}`)
      .order('last_message_at', { ascending: false });

    if (!convRows) { setLoading(false); return; }

    const otherIds = convRows.map(c =>
      (c.user_1 as string) === myUserId ? (c.user_2 as string) : (c.user_1 as string)
    );
    const uniqueIds = [...new Set(otherIds)].filter(id => !profilesRef.current.has(id));

    if (uniqueIds.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, username, is_online, last_seen, phone')
        .in('id', uniqueIds);

      if (profileRows) {
        for (const p of profileRows) {
          profilesRef.current.set(p.id, { ...p, user_id: p.id } as unknown as ProfileRow);
        }
      }
    }

    const convIds = convRows.map(c => c.id as string);
    const unreadMap = new Map<string, number>();

    if (convIds.length > 0) {
      const { data: unreadRows } = await supabase
        .from('private_messages')
        .select('conversation_id')
        .in('conversation_id', convIds)
        .neq('sender_id', myUserId)
        .eq('is_read', false);

      if (unreadRows) {
        for (const r of unreadRows) {
          const cid = r.conversation_id as string;
          unreadMap.set(cid, (unreadMap.get(cid) ?? 0) + 1);
        }
      }
    }

    const items: ConversationItem[] = [];
    for (const c of convRows) {
      const otherId = (c.user_1 as string) === myUserId
        ? (c.user_2 as string)
        : (c.user_1 as string);

      if (blockedIds.has(otherId) || c.blocked_by) continue;

      const profile = profilesRef.current.get(otherId);
      items.push(
        mapConversation(
          c as unknown as Record<string, unknown>,
          profile,
          myUserId,
          unreadMap.get(c.id as string) ?? 0
        )
      );
    }

    setConversations(items);
    setLoading(false);
  }, [myUserId, blockedIds]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!myUserId) return;
    const channel = supabase
      .channel('conv-list-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'private_chats' }, () => {
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [myUserId, load]);

  const getProfile = useCallback((userId: string): ProfileRow | undefined => {
    return profilesRef.current.get(userId);
  }, []);

  const getProfiles = useCallback((): Map<string, ProfileRow> => {
    return new Map(profilesRef.current);
  }, []);

  return {
    conversations,
    loading,
    reload: load,
    getProfile,
    getProfiles,
  };
}