import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface NotificationPref {
  scopeId: string;
  scopeType: 'conversation' | 'group';
  soundEnabled: boolean;
  soundName: string;
  vibrate: boolean;
  showPreview: boolean;
}

const DEFAULT_PREF: Omit<NotificationPref, 'scopeId' | 'scopeType'> = {
  soundEnabled: true,
  soundName: 'default',
  vibrate: true,
  showPreview: true,
};

export function useNotificationPreferences(currentUserId: string | undefined) {
  const [prefs, setPrefs] = useState<Map<string, NotificationPref>>(new Map());

  const loadPrefs = useCallback(async () => {
    if (!currentUserId) return;
    const { data } = await supabase.from('notification_preferences')
      .select('*')
      .eq('user_id', currentUserId);
    if (data) {
      const map = new Map<string, NotificationPref>();
      for (const r of data) {
        const row = r as Record<string, unknown>;
        const scopeId = String(row.scope_id);
        map.set(scopeId, {
          scopeId,
          scopeType: String(row.scope_type ?? 'conversation') as 'conversation' | 'group',
          soundEnabled: row.sound_enabled !== false,
          soundName: String(row.sound_name ?? 'default'),
          vibrate: row.vibrate !== false,
          showPreview: row.show_preview !== false,
        });
      }
      setPrefs(map);
    }
  }, [currentUserId]);

  useEffect(() => { loadPrefs(); }, [loadPrefs]);

  const updatePref = useCallback(async (scopeId: string, scopeType: 'conversation' | 'group', updates: Partial<NotificationPref>) => {
    if (!currentUserId) return;
    const current = prefs.get(scopeId) || { ...DEFAULT_PREF, scopeId, scopeType };
    const merged = { ...current, ...updates };

    await supabase.from('notification_preferences').upsert({
      user_id: currentUserId,
      scope_id: scopeId,
      scope_type: scopeType,
      sound_enabled: merged.soundEnabled,
      sound_name: merged.soundName,
      vibrate: merged.vibrate,
      show_preview: merged.showPreview,
    } as any, { onConflict: 'user_id,scope_id' });

    setPrefs(prev => new Map(prev).set(scopeId, merged));
    toast.success('Preferencias actualizadas');
  }, [currentUserId, prefs]);

  const getPref = useCallback((scopeId: string): NotificationPref => {
    return prefs.get(scopeId) || { ...DEFAULT_PREF, scopeId, scopeType: 'conversation' };
  }, [prefs]);

  return { prefs, getPref, updatePref, loadPrefs };
}