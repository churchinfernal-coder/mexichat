import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SharedMediaItem {
  id: string;
  url: string;
  type: 'image' | 'video' | 'audio' | 'file';
  fileName: string | null;
  senderName: string;
  createdAt: string;
}

export type MediaTab = 'photos' | 'videos' | 'files' | 'audio' | 'links';

export function useSharedMedia() {
  const [items, setItems] = useState<SharedMediaItem[]>([]);
  const [activeTab, setActiveTab] = useState<MediaTab>('photos');
  const [loading, setLoading] = useState(false);

  const loadMedia = useCallback(async (
    scopeType: 'conversation' | 'group',
    scopeId: string,
    tab: MediaTab,
  ) => {
    setLoading(true);
    setActiveTab(tab);

    try {
      const table = scopeType === 'conversation' ? 'private_messages' : 'group_messages';
      const column = scopeType === 'conversation' ? 'conversation_id' : 'group_id';

      let mediaTypeFilter: string;
      switch (tab) {
        case 'photos': mediaTypeFilter = 'image%'; break;
        case 'videos': mediaTypeFilter = 'video%'; break;
        case 'audio': mediaTypeFilter = 'audio%'; break;
        case 'files': mediaTypeFilter = 'application%'; break;
        case 'links': mediaTypeFilter = '__links__'; break;
        default: mediaTypeFilter = 'image%';
      }

      if (tab === 'links') {
        const { data } = await supabase.from(table)
          .select('id, content, sender_id, created_at')
          .eq(column, scopeId)
          .like('content', '%http%')
          .order('created_at', { ascending: false })
          .limit(100);

        if (data) {
          const senderIds = [...new Set(data.map(r => String((r as Record<string, unknown>).sender_id)))];
          const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', senderIds);
          const nameMap = new Map<string, string>();
          if (profiles) profiles.forEach(p => nameMap.set(String((p as Record<string, unknown>).id), String((p as Record<string, unknown>).full_name ?? '')));

          setItems(data.map(r => {
            const row = r as Record<string, unknown>;
            const content = String(row.content ?? '');
            const urlMatch = content.match(/(https?:\/\/[^\s]+)/);
            return {
              id: String(row.id),
              url: urlMatch?.[1] ?? content,
              type: 'file' as const,
              fileName: urlMatch?.[1] ?? null,
              senderName: nameMap.get(String(row.sender_id)) ?? 'Usuario',
              createdAt: String(row.created_at),
            };
          }));
        }
      } else {
        const { data } = await supabase.from(table)
          .select('id, media_url, media_type, sender_id, created_at')
          .eq(column, scopeId)
          .not('media_url', 'is', null)
          .like('media_type', mediaTypeFilter)
          .order('created_at', { ascending: false })
          .limit(100);

        if (data) {
          const senderIds = [...new Set(data.map(r => String((r as Record<string, unknown>).sender_id)))];
          const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', senderIds);
          const nameMap = new Map<string, string>();
          if (profiles) profiles.forEach(p => nameMap.set(String((p as Record<string, unknown>).id), String((p as Record<string, unknown>).full_name ?? '')));

          setItems(data.map(r => {
            const row = r as Record<string, unknown>;
            const mt = String(row.media_type ?? '');
            let type: SharedMediaItem['type'] = 'file';
            if (mt.startsWith('image')) type = 'image';
            else if (mt.startsWith('video')) type = 'video';
            else if (mt.startsWith('audio')) type = 'audio';
            return {
              id: String(row.id),
              url: String(row.media_url ?? ''),
              type,
              fileName: null,
              senderName: nameMap.get(String(row.sender_id)) ?? 'Usuario',
              createdAt: String(row.created_at),
            };
          }));
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => { setItems([]); setActiveTab('photos'); }, []);

  return { items, activeTab, loading, loadMedia, setActiveTab, clear };
}