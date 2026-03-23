import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ThreadMessage {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  createdAt: string;
  mediaUrl: string | null;
  mediaType: string | null;
}

export interface ActiveThread {
  parentId: string;
  parentContent: string;
  parentSender: string;
  replies: ThreadMessage[];
}

export function useThreadReplies(currentUserId: string | undefined) {
  const [activeThread, setActiveThread] = useState<ActiveThread | null>(null);
  const [loading, setLoading] = useState(false);

  const openThread = useCallback(async (
    parentId: string,
    parentContent: string,
    parentSender: string,
    messageTable: 'private_messages' | 'group_messages',
  ) => {
    setLoading(true);
    try {
      const { data } = await supabase.from(messageTable)
        .select('id, content, sender_id, created_at, media_url, media_type')
        .eq('reply_to', parentId)
        .order('created_at', { ascending: true });

      if (!data) { setActiveThread({ parentId, parentContent, parentSender, replies: [] }); return; }

      const senderIds = [...new Set(data.map(r => String((r as Record<string, unknown>).sender_id)))];
      const { data: profiles } = await supabase.from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', senderIds);

      const profileMap = new Map<string, Record<string, unknown>>();
      if (profiles) profiles.forEach(p => profileMap.set(String((p as Record<string, unknown>).id), p as Record<string, unknown>));

      const replies: ThreadMessage[] = data.map(r => {
        const row = r as Record<string, unknown>;
        const profile = profileMap.get(String(row.sender_id));
        return {
          id: String(row.id),
          content: String(row.content ?? ''),
          senderId: String(row.sender_id),
          senderName: String(profile?.full_name ?? 'Usuario'),
          senderAvatar: profile?.avatar_url ? String(profile.avatar_url) : null,
          createdAt: String(row.created_at),
          mediaUrl: row.media_url ? String(row.media_url) : null,
          mediaType: row.media_type ? String(row.media_type) : null,
        };
      });

      setActiveThread({ parentId, parentContent, parentSender, replies });
    } finally {
      setLoading(false);
    }
  }, []);

  const closeThread = useCallback(() => { setActiveThread(null); }, []);

  const getReplyCount = useCallback(async (
    messageIds: string[],
    messageTable: 'private_messages' | 'group_messages',
  ): Promise<Map<string, number>> => {
    if (!messageIds.length) return new Map();
    const counts = new Map<string, number>();
    // Batch query for reply counts
    for (const id of messageIds) {
      const { count } = await supabase.from(messageTable)
        .select('id', { count: 'exact', head: true })
        .eq('reply_to', id);
      if (count && count > 0) counts.set(id, count);
    }
    return counts;
  }, []);

  return { activeThread, loading, openThread, closeThread, getReplyCount };
}