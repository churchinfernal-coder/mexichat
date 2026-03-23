import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface StarredMessage {
  id: string;
  messageId: string;
  messageTable: string;
  content: string;
  senderName: string;
  starredAt: string;
}

export function useStarredMessages(currentUserId: string | undefined) {
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [starredMessages, setStarredMessages] = useState<StarredMessage[]>([]);
  const [showPanel, setShowPanel] = useState(false);

  const loadStarredIds = useCallback(async () => {
    if (!currentUserId) return;
    const { data } = await supabase.from('starred_messages')
      .select('message_id')
      .eq('user_id', currentUserId);
    if (data) setStarredIds(new Set(data.map(r => String((r as Record<string, unknown>).message_id))));
  }, [currentUserId]);

  useEffect(() => { loadStarredIds(); }, [loadStarredIds]);

  const toggleStar = useCallback(async (messageId: string, messageTable: string, content: string) => {
    if (!currentUserId) return;

    if (starredIds.has(messageId)) {
      await supabase.from('starred_messages')
        .delete()
        .eq('user_id', currentUserId)
        .eq('message_id', messageId);
      setStarredIds(prev => { const next = new Set(prev); next.delete(messageId); return next; });
      setStarredMessages(prev => prev.filter(s => s.messageId !== messageId));
      toast.success('Desmarcado');
    } else {
      await supabase.from('starred_messages').insert({
        user_id: currentUserId,
        message_id: messageId,
        message_table: messageTable,
        content: content.slice(0, 500),
      });
      setStarredIds(prev => new Set(prev).add(messageId));
      toast.success('Mensaje destacado ⭐');
    }
  }, [currentUserId, starredIds]);

  const loadAllStarred = useCallback(async () => {
    if (!currentUserId) return;
    const { data } = await supabase.from('starred_messages')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false });

    if (!data) return;

    setStarredMessages(data.map(r => {
      const row = r as Record<string, unknown>;
      return {
        id: String(row.id),
        messageId: String(row.message_id),
        messageTable: String(row.message_table ?? ''),
        content: String(row.content ?? ''),
        senderName: '',
        starredAt: String(row.created_at),
      };
    }));
  }, [currentUserId]);

  const isStarred = useCallback((messageId: string) => starredIds.has(messageId), [starredIds]);

  return { starredIds, starredMessages, showPanel, setShowPanel, toggleStar, isStarred, loadAllStarred };
}