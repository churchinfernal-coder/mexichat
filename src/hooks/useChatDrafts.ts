import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'mc_chat_drafts';

export interface DraftMap {
  [scopeId: string]: string;
}

export function useChatDrafts() {
  const [drafts, setDrafts] = useState<DraftMap>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts)); } catch {}
  }, [drafts]);

  const setDraft = useCallback((scopeId: string, text: string) => {
    setDrafts(prev => {
      if (!text.trim()) {
        const next = { ...prev };
        delete next[scopeId];
        return next;
      }
      return { ...prev, [scopeId]: text };
    });
  }, []);

  const getDraft = useCallback((scopeId: string): string => {
    return drafts[scopeId] || '';
  }, [drafts]);

  const clearDraft = useCallback((scopeId: string) => {
    setDrafts(prev => {
      const next = { ...prev };
      delete next[scopeId];
      return next;
    });
  }, []);

  const hasDraft = useCallback((scopeId: string): boolean => {
    return !!drafts[scopeId]?.trim();
  }, [drafts]);

  return { drafts, setDraft, getDraft, clearDraft, hasDraft };
}