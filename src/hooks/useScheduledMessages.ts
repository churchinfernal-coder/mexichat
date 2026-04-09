/**
 * MEXICHAT — useScheduledMessages hook
 * Write now, send later. Stores in Supabase, ticks every 10s.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ScheduledMessage {
  id: string;
  userId: string;
  conversationId: string | null;
  groupId: string | null;
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
  sendAt: string;
  isSent: boolean;
  createdAt: string;
}

export function useScheduledMessages(
  userId: string | undefined,
  sendDm: (convId: string, content: string, mediaUrl?: string, mediaType?: string) => void,
  sendGroup: (groupId: string, content: string, mediaUrl?: string, mediaType?: string) => void,
) {
  const [scheduled, setScheduled] = useState<ScheduledMessage[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval>>();
  const sentIds = useRef(new Set<string>());

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await (supabase.from('scheduled_messages' as any).select('*') as any)
      .eq('user_id', userId).eq('is_sent', false).order('send_at', { ascending: true });
    if (data) setScheduled((data as any[]).map((r: any) => ({
      id: r.id, userId: r.user_id, conversationId: r.conversation_id, groupId: r.group_id,
      content: r.content, mediaUrl: r.media_url, mediaType: r.media_type,
      sendAt: r.send_at, isSent: r.is_sent, createdAt: r.created_at,
    })));
  }, [userId]);

  const schedule = useCallback(async (opts: {
    content: string; sendAt: Date; conversationId?: string; groupId?: string;
    mediaUrl?: string; mediaType?: string;
  }) => {
    if (!userId) return;
    const { error } = await (supabase.from('scheduled_messages' as any).insert({
      user_id: userId, content: opts.content, send_at: opts.sendAt.toISOString(),
      conversation_id: opts.conversationId || null, group_id: opts.groupId || null,
      media_url: opts.mediaUrl || null, media_type: opts.mediaType || null,
    } as any) as any);
    if (error) { toast.error('Error al programar'); return; }
    toast.success('Mensaje programado');
    load();
  }, [userId, load]);

  const cancel = useCallback(async (id: string) => {
    await (supabase.from('scheduled_messages' as any).delete() as any).eq('id', id);
    setScheduled(prev => prev.filter(s => s.id !== id));
    toast.success('Mensaje cancelado');
  }, []);

  // Tick: send due messages
  useEffect(() => {
    if (!userId) return;
    load();
    tickRef.current = setInterval(() => {
      const now = Date.now();
      setScheduled(prev => {
        for (const s of prev) {
          if (s.isSent || sentIds.current.has(s.id)) continue;
          if (new Date(s.sendAt).getTime() <= now) {
            sentIds.current.add(s.id);
            if (s.conversationId) sendDm(s.conversationId, s.content, s.mediaUrl || undefined, s.mediaType || undefined);
            else if (s.groupId) sendGroup(s.groupId, s.content, s.mediaUrl || undefined, s.mediaType || undefined);
            (supabase.from('scheduled_messages' as any).update({ is_sent: true } as any) as any).eq('id', s.id);
            toast.success('Mensaje programado enviado');
          }
        }
        return prev.filter(s => !sentIds.current.has(s.id));
      });
    }, 10000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [userId, load, sendDm, sendGroup]);

  return { scheduled, schedule, cancel, load };
}