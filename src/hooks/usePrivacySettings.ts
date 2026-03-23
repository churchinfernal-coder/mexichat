import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type VisibilitySetting = 'everyone' | 'contacts' | 'nobody';

export interface PrivacyConfig {
  lastSeenVisibility: VisibilitySetting;
  onlineVisibility: VisibilitySetting;
  avatarVisibility: VisibilitySetting;
  readReceipts: boolean;
}

const DEFAULT_PRIVACY: PrivacyConfig = {
  lastSeenVisibility: 'everyone',
  onlineVisibility: 'everyone',
  avatarVisibility: 'everyone',
  readReceipts: true,
};

export function usePrivacySettings(currentUserId: string | undefined) {
  const [privacy, setPrivacy] = useState<PrivacyConfig>(DEFAULT_PRIVACY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUserId) return;
    supabase.from('privacy_settings')
      .select('*')
      .eq('user_id', currentUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const row = data as Record<string, unknown>;
          setPrivacy({
            lastSeenVisibility: (String(row.last_seen_visibility ?? 'everyone')) as VisibilitySetting,
            onlineVisibility: (String(row.online_visibility ?? 'everyone')) as VisibilitySetting,
            avatarVisibility: (String(row.avatar_visibility ?? 'everyone')) as VisibilitySetting,
            readReceipts: row.read_receipts !== false,
          });
        }
      });
  }, [currentUserId]);

  const updatePrivacy = useCallback(async (updates: Partial<PrivacyConfig>) => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.lastSeenVisibility !== undefined) dbUpdates.last_seen_visibility = updates.lastSeenVisibility;
      if (updates.onlineVisibility !== undefined) dbUpdates.online_visibility = updates.onlineVisibility;
      if (updates.avatarVisibility !== undefined) dbUpdates.avatar_visibility = updates.avatarVisibility;
      if (updates.readReceipts !== undefined) dbUpdates.read_receipts = updates.readReceipts;

      const { error } = await supabase.from('privacy_settings')
        .upsert({ user_id: currentUserId, ...dbUpdates } as any, { onConflict: 'user_id' });

      if (error) { toast.error('Error al guardar'); return; }
      setPrivacy(prev => ({ ...prev, ...updates }));
      toast.success('Privacidad actualizada');
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  return { privacy, loading, updatePrivacy };
}