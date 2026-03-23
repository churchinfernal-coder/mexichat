import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PinnedMessage {
  id: string;
  messageId: string;
  content: string;
  senderName: string;
  pinnedBy: string;
  pinnedAt: string;
  messageTable: string;
}

export function usePinnedMessages(
  scopeType: 'conversation' | 'group',
  scopeId: string | null,
  currentUserId: string | undefined,
) {
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);

  const loadPinned = useCallback(async () => {
    if (!scopeId) return;
    const column = scopeType === 'conversation' ? 'conversation_id' : 'group_id';
    const { data } = await supabase.from('pinned_messages')
      .select('*')
      .eq(column, scopeId)
      .order('pinned_at', { ascending: false });

    if (!data) return;

    const senderIds = [...new Set(data.map(r => String((r as Record<string, unknown>).pinned_by)))];
    const { data: profiles } = await supabase.from('profiles')
      .select('id, full_name').in('id', senderIds);
    const nameMap = new Map<string, string>();
    if (profiles) profiles.forEach(p => nameMap.set(String((p as Record<string, unknown>).id), String((p as Record<string, unknown>).full_name ?? 'Usuario')));

    setPinnedMessages(data.map(r => {
      const row = r as Record<string, unknown>;
      return {
        id: String(row.id),
        messageId: String(row.message_id),
        content: String(row.content ?? ''),
        senderName: nameMap.get(String(row.pinned_by)) ?? 'Usuario',
        pinnedBy: String(row.pinned_by),
        pinnedAt: String(row.pinned_at ?? row.created_at),
        messageTable: String(row.message_table ?? ''),
      };
    }));
  }, [scopeId, scopeType]);

  useEffect(() => { loadPinned(); }, [loadPinned]);

  const pinMessage = useCallback(async (messageId: string, content: string) => {
    if (!scopeId || !currentUserId) return;
    const column = scopeType === 'conversation' ? 'conversation_id' : 'group_id';
    const messageTable = scopeType === 'conversation' ? 'private_messages' : 'group_messages';

    const { error } = await supabase.from('pinned_messages').insert({
      message_id: messageId,
      [column]: scopeId,
      content,
      pinned_by: currentUserId,
      message_table: messageTable,
      pinned_at: new Date().toISOString(),
    });

    if (error) {
      if (error.code === '23505') toast.info('Ya está fijado');
      else toast.error('Error al fijar mensaje');
      return;
    }
    toast.success('Mensaje fijado');
    loadPinned();
  }, [scopeId, scopeType, currentUserId, loadPinned]);

  const unpinMessage = useCallback(async (pinId: string) => {
    await supabase.from('pinned_messages').delete().eq('id', pinId);
    setPinnedMessages(prev => prev.filter(p => p.id !== pinId));
    toast.success('Mensaje desfijado');
  }, []);

  return { pinnedMessages, showPinnedPanel, setShowPinnedPanel, pinMessage, unpinMessage, loadPinned };
}