import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseRealtimeMessagesOptions<T> {
  table: 'private_messages' | 'group_messages';
  filterColumn: string;
  filterId: string | null;
  currentUserId: string | null;
  mapper: (row: Record<string, unknown>) => T;
  onInsert: (msg: T, raw: Record<string, unknown>) => void;
  onUpdate?: (msg: T, raw: Record<string, unknown>) => void;
  onDelete?: (id: string) => void;
}

export function useRealtimeMessages<T>(options: UseRealtimeMessagesOptions<T>): void {
  const {
    table,
    filterColumn,
    filterId,
    currentUserId,
    mapper,
    onInsert,
    onUpdate,
    onDelete,
  } = options;

  const seenIdsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!filterId || !currentUserId) return;
    seenIdsRef.current.clear();

    const channel = supabase
      .channel(`rt-${table}:${filterId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table,
        filter: `${filterColumn}=eq.${filterId}`,
      }, (payload) => {
        const raw = payload.new as Record<string, unknown>;
        const id = raw.id as string;
        if (seenIdsRef.current.has(id)) return;
        seenIdsRef.current.add(id);
        const mapped = mapper(raw);
        onInsert(mapped, raw);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table,
        filter: `${filterColumn}=eq.${filterId}`,
      }, (payload) => {
        if (!onUpdate) return;
        const raw = payload.new as Record<string, unknown>;
        const mapped = mapper(raw);
        onUpdate(mapped, raw);
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table,
        filter: `${filterColumn}=eq.${filterId}`,
      }, (payload) => {
        if (!onDelete) return;
        const raw = payload.old as Record<string, unknown>;
        onDelete(raw.id as string);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filterColumn, filterId, currentUserId, mapper, onInsert, onUpdate, onDelete]);
}