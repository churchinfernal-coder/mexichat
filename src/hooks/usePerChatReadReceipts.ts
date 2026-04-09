/**
 * MEXICHAT — usePerChatReadReceipts
 * Per-conversation toggle to hide/show read receipts (blue checks).
 * Stored in localStorage for instant access + Supabase for sync.
 */
import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'mc_read_receipts_off';

export function usePerChatReadReceipts() {
  const [disabledChats, setDisabledChats] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...disabledChats])); } catch {}
  }, [disabledChats]);

  const isReceiptsDisabled = useCallback((chatId: string) => disabledChats.has(chatId), [disabledChats]);

  const toggleReceipts = useCallback((chatId: string) => {
    setDisabledChats(prev => {
      const next = new Set(prev);
      if (next.has(chatId)) next.delete(chatId);
      else next.add(chatId);
      return next;
    });
  }, []);

  return { isReceiptsDisabled, toggleReceipts, disabledChats };
}