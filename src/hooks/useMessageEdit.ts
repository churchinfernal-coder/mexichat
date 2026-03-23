import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EditState {
  messageId: string;
  originalContent: string;
}

export function useMessageEdit(
  currentUserId: string | undefined,
  messageTable: 'private_messages' | 'group_messages',
) {
  const [editingMessage, setEditingMessage] = useState<EditState | null>(null);

  const startEditing = useCallback((messageId: string, content: string) => {
    setEditingMessage({ messageId, originalContent: content });
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingMessage(null);
  }, []);

  const saveEdit = useCallback(async (newContent: string) => {
    if (!editingMessage || !currentUserId) return false;
    if (!newContent.trim()) { toast.error('El mensaje no puede estar vacío'); return false; }
    if (newContent.trim() === editingMessage.originalContent.trim()) { setEditingMessage(null); return true; }

    const { error } = await supabase.from(messageTable)
      .update({
        content: newContent.trim(),
        edited_at: new Date().toISOString(),
        original_content: editingMessage.originalContent,
      } as any)
      .eq('id', editingMessage.messageId)
      .eq('sender_id', currentUserId);

    if (error) { toast.error('Error al editar'); return false; }
    setEditingMessage(null);
    toast.success('Mensaje editado');
    return true;
  }, [editingMessage, currentUserId, messageTable]);

  const canEdit = useCallback((senderId: string, createdAt: string) => {
    if (senderId !== currentUserId) return false;
    // Allow editing within 15 minutes
    const diff = Date.now() - new Date(createdAt).getTime();
    return diff < 15 * 60 * 1000;
  }, [currentUserId]);

  return { editingMessage, startEditing, cancelEditing, saveEdit, canEdit };
}