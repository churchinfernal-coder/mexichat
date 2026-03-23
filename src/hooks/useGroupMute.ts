import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type MuteDuration = 'off' | '1h' | '8h' | '1w' | 'forever';

export function useGroupMute(currentUserId: string | undefined) {
  const [mutedGroups, setMutedGroups] = useState<Map<string, string>>(new Map()); // groupId -> mute_until

  const loadMuted = useCallback(async () => {
    if (!currentUserId) return;
    const { data } = await supabase.from('group_members')
      .select('group_id, muted_until')
      .eq('user_id', currentUserId)
      .not('muted_until', 'is', null);
    if (data) {
      const map = new Map<string, string>();
      for (const r of data) {
        const row = r as Record<string, unknown>;
        map.set(String(row.group_id), String(row.muted_until));
      }
      setMutedGroups(map);
    }
  }, [currentUserId]);

  useEffect(() => { loadMuted(); }, [loadMuted]);

  const muteGroup = useCallback(async (groupId: string, duration: MuteDuration) => {
    if (!currentUserId) return;
    let mutedUntil: string | null = null;

    switch (duration) {
      case '1h': mutedUntil = new Date(Date.now() + 3600000).toISOString(); break;
      case '8h': mutedUntil = new Date(Date.now() + 28800000).toISOString(); break;
      case '1w': mutedUntil = new Date(Date.now() + 604800000).toISOString(); break;
      case 'forever': mutedUntil = new Date('2099-12-31').toISOString(); break;
      case 'off': mutedUntil = null; break;
    }

    await supabase.from('group_members')
      .update({ muted_until: mutedUntil } as any)
      .eq('group_id', groupId)
      .eq('user_id', currentUserId);

    if (mutedUntil) {
      setMutedGroups(prev => new Map(prev).set(groupId, mutedUntil));
      toast.success('Grupo silenciado');
    } else {
      setMutedGroups(prev => { const m = new Map(prev); m.delete(groupId); return m; });
      toast.success('Notificaciones activadas');
    }
  }, [currentUserId]);

  const isGroupMuted = useCallback((groupId: string): boolean => {
    const until = mutedGroups.get(groupId);
    if (!until) return false;
    return new Date(until) > new Date();
  }, [mutedGroups]);

  return { mutedGroups, muteGroup, isGroupMuted, loadMuted };
}