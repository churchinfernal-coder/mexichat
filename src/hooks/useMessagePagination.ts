import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const PAGE_SIZE = 50;

export function useMessagePagination<T>(
  tableName: 'private_messages' | 'group_messages',
  filterColumn: string,
  mapper: (row: Record<string, unknown>) => T
) {
  const [messages, setMessages] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const hasMoreRef = useRef(true);
  const activeIdRef = useRef<string | null>(null);
  const oldestRef = useRef<string | null>(null);

  const loadInitial = useCallback(async (filterId: string) => {
    activeIdRef.current = filterId;
    setLoading(true);
    hasMoreRef.current = true;
    oldestRef.current = null;

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq(filterColumn, filterId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (!error && data && activeIdRef.current === filterId) {
      const sorted = [...data].reverse();
      const mapped = sorted.map(r => mapper(r as Record<string, unknown>));
      setMessages(mapped);
      hasMoreRef.current = data.length === PAGE_SIZE;
      if (sorted.length > 0) {
        oldestRef.current = (sorted[0] as Record<string, unknown>).created_at as string;
      }
    }
    setLoading(false);
  }, [tableName, filterColumn, mapper]);

  const loadOlder = useCallback(async () => {
    if (!activeIdRef.current || !hasMoreRef.current || loading || !oldestRef.current) return;
    setLoading(true);

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq(filterColumn, activeIdRef.current)
      .lt('created_at', oldestRef.current)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (!error && data) {
      const sorted = [...data].reverse();
      const mapped = sorted.map(r => mapper(r as Record<string, unknown>));
      setMessages(prev => [...mapped, ...prev]);
      hasMoreRef.current = data.length === PAGE_SIZE;
      if (sorted.length > 0) {
        oldestRef.current = (sorted[0] as Record<string, unknown>).created_at as string;
      }
    }
    setLoading(false);
  }, [tableName, filterColumn, mapper, loading]);

  const addMessage = useCallback((msg: T) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const updateMessage = useCallback((id: string, updater: (msg: T) => T) => {
    setMessages(prev => prev.map(m => {
      const mAny = m as Record<string, unknown>;
      return mAny.id === id ? updater(m) : m;
    }));
  }, []);

  const removeMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(m => (m as Record<string, unknown>).id !== id));
  }, []);

  const removeMessages = useCallback((ids: Set<string>) => {
    setMessages(prev => prev.filter(m => !ids.has((m as Record<string, unknown>).id as string)));
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    hasMoreRef.current = true;
    oldestRef.current = null;
    activeIdRef.current = null;
  }, []);

  return {
    messages,
    setMessages,
    loading,
    hasMore: hasMoreRef,
    loadInitial,
    loadOlder,
    addMessage,
    updateMessage,
    removeMessage,
    removeMessages,
    reset,
  };
}