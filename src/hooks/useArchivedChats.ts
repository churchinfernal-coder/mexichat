import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useArchivedChats(currentUserId: string | undefined) {
  const [archivedConvIds, setArchivedConvIds] = useState<Set<string>>(new Set());
  const [archivedGroupIds, setArchivedGroupIds] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);

  const loadArchived = useCallback(async () => {
    if (!currentUserId) return;
    const { data: convs } = await supabase.from('conversations')
      .select('id')
      .or(`user_1.eq.${currentUserId},user_2.eq.${currentUserId}`)
      .eq('is_archived', true);
    if (convs) setArchivedConvIds(new Set(convs.map(r => String((r as Record<string, unknown>).id))));

    const { data: groups } = await supabase.from('group_members')
      .select('group_id')
      .eq('user_id', currentUserId)
      .eq('is_archived', true);
    if (groups) setArchivedGroupIds(new Set(groups.map(r => String((r as Record<string, unknown>).group_id))));
  }, [currentUserId]);

  const archiveConversation = useCallback(async (convId: string) => {
    await supabase.from('conversations').update({ is_archived: true } as any).eq('id', convId);
    setArchivedConvIds(prev => new Set(prev).add(convId));
    toast.success('Conversación archivada');
  }, []);

  const unarchiveConversation = useCallback(async (convId: string) => {
    await supabase.from('conversations').update({ is_archived: false } as any).eq('id', convId);
    setArchivedConvIds(prev => { const next = new Set(prev); next.delete(convId); return next; });
    toast.success('Conversación desarchivada');
  }, []);

  const archiveGroup = useCallback(async (groupId: string) => {
    if (!currentUserId) return;
    await supabase.from('group_members')
      .update({ is_archived: true } as any)
      .eq('group_id', groupId)
      .eq('user_id', currentUserId);
    setArchivedGroupIds(prev => new Set(prev).add(groupId));
    toast.success('Grupo archivado');
  }, [currentUserId]);

  const unarchiveGroup = useCallback(async (groupId: string) => {
    if (!currentUserId) return;
    await supabase.from('group_members')
      .update({ is_archived: false } as any)
      .eq('group_id', groupId)
      .eq('user_id', currentUserId);
    setArchivedGroupIds(prev => { const next = new Set(prev); next.delete(groupId); return next; });
    toast.success('Grupo desarchivado');
  }, []);

  const isArchived = useCallback((id: string, type: 'conv' | 'group') => {
    return type === 'conv' ? archivedConvIds.has(id) : archivedGroupIds.has(id);
  }, [archivedConvIds, archivedGroupIds]);

  return {
    archivedConvIds, archivedGroupIds, showArchived, setShowArchived,
    loadArchived, archiveConversation, unarchiveConversation, archiveGroup, unarchiveGroup, isArchived,
  };
}