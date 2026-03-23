import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SearchResult {
  id: string;
  content: string;
  senderName: string;
  createdAt: string;
  mediaType: string | null;
}

export function useMessageSearch(currentUserId: string | undefined) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const searchDmMessages = useCallback(async (conversationId: string, searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const { data } = await supabase.from('private_messages')
        .select('id, content, sender_id, created_at, media_type')
        .eq('conversation_id', conversationId)
        .ilike('content', `%${searchQuery}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!data) { setResults([]); return; }

      const senderIds = [...new Set(data.map(r => String((r as Record<string, unknown>).sender_id)))];
      const { data: profiles } = await supabase.from('profiles')
        .select('id, full_name')
        .in('id', senderIds);

      const nameMap = new Map<string, string>();
      if (profiles) profiles.forEach(p => nameMap.set(String((p as Record<string, unknown>).id), String((p as Record<string, unknown>).full_name ?? 'Usuario')));

      setResults(data.map(r => {
        const row = r as Record<string, unknown>;
        return {
          id: String(row.id),
          content: String(row.content ?? ''),
          senderName: nameMap.get(String(row.sender_id)) ?? 'Usuario',
          createdAt: String(row.created_at),
          mediaType: row.media_type ? String(row.media_type) : null,
        };
      }));
    } finally {
      setSearching(false);
    }
  }, []);

  const searchGroupMessages = useCallback(async (groupId: string, searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const { data } = await supabase.from('group_messages')
        .select('id, content, sender_id, created_at, media_type')
        .eq('group_id', groupId)
        .ilike('content', `%${searchQuery}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!data) { setResults([]); return; }

      const senderIds = [...new Set(data.map(r => String((r as Record<string, unknown>).sender_id)))];
      const { data: profiles } = await supabase.from('profiles')
        .select('id, full_name')
        .in('id', senderIds);

      const nameMap = new Map<string, string>();
      if (profiles) profiles.forEach(p => nameMap.set(String((p as Record<string, unknown>).id), String((p as Record<string, unknown>).full_name ?? 'Usuario')));

      setResults(data.map(r => {
        const row = r as Record<string, unknown>;
        return {
          id: String(row.id),
          content: String(row.content ?? ''),
          senderName: nameMap.get(String(row.sender_id)) ?? 'Usuario',
          createdAt: String(row.created_at),
          mediaType: row.media_type ? String(row.media_type) : null,
        };
      }));
    } finally {
      setSearching(false);
    }
  }, []);

  const debouncedSearch = useCallback((scopeId: string, type: 'dm' | 'group', q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (type === 'dm') searchDmMessages(scopeId, q);
      else searchGroupMessages(scopeId, q);
    }, 300);
  }, [searchDmMessages, searchGroupMessages]);

  const clear = useCallback(() => {
    setResults([]);
    setQuery('');
    setSearching(false);
  }, []);

  return { results, searching, query, debouncedSearch, clear };
}