import { useState, useCallback } from 'react';

export function useBulkSelect() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelecting(false);
  }, []);

  const startSelecting = useCallback(() => setIsSelecting(true), []);
  const stopSelecting = useCallback(() => { setIsSelecting(false); setSelectedIds(new Set()); }, []);

  return {
    selectedIds,
    isSelecting,
    selectedCount: selectedIds.size,
    toggleSelect,
    selectAll,
    clearSelection,
    startSelecting,
    stopSelecting,
  };
}