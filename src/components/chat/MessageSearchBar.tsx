import React, { useRef, useEffect } from 'react';
import { Search, X as XIcon, ArrowDown, ArrowUp } from 'lucide-react';
import type { SearchResult } from '@/hooks/useMessageSearch';

export interface MessageSearchBarProps {
  query: string;
  results: SearchResult[];
  searching: boolean;
  onSearch: (query: string) => void;
  onClose: () => void;
  onJumpToMessage: (messageId: string) => void;
}

const MessageSearchBar: React.FC<MessageSearchBarProps> = ({
  query, results, searching, onSearch, onClose, onJumpToMessage,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIdx, setActiveIdx] = React.useState(0);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setActiveIdx(0); }, [results]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown' && results.length > 0) {
      e.preventDefault();
      const next = (activeIdx + 1) % results.length;
      setActiveIdx(next);
      onJumpToMessage(results[next].id);
    }
    if (e.key === 'ArrowUp' && results.length > 0) {
      e.preventDefault();
      const prev = (activeIdx - 1 + results.length) % results.length;
      setActiveIdx(prev);
      onJumpToMessage(results[prev].id);
    }
    if (e.key === 'Enter' && results.length > 0) {
      onJumpToMessage(results[activeIdx].id);
    }
  };

  const highlight = (text: string, q: string) => {
    if (!q.trim()) return text;
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} style={{ background: 'rgba(var(--mc-blue-rgb, 220,38,38), 0.3)', color: 'inherit', borderRadius: '2px', padding: '0 1px' }}>{part}</mark> : part
    );
  };

  return (
    <div style={{ borderBottom: '1px solid var(--mc-border)', background: 'var(--mc-sidebar)' }}>
      {/* Search input row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px' }}>
        <Search size={16} style={{ color: 'var(--mc-text-muted)', flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar en la conversación..."
          style={{
            flex: 1, padding: '6px 0', background: 'none', border: 'none',
            color: 'var(--mc-text)', fontSize: '14px', outline: 'none',
          }}
        />
        {results.length > 0 && (
          <span style={{ fontSize: '12px', color: 'var(--mc-text-muted)', whiteSpace: 'nowrap' }}>
            {activeIdx + 1}/{results.length}
          </span>
        )}
        {results.length > 0 && (
          <div style={{ display: 'flex', gap: '2px' }}>
            <button onClick={() => { const prev = (activeIdx - 1 + results.length) % results.length; setActiveIdx(prev); onJumpToMessage(results[prev].id); }}
              style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer', padding: '4px' }}><ArrowUp size={14} /></button>
            <button onClick={() => { const next = (activeIdx + 1) % results.length; setActiveIdx(next); onJumpToMessage(results[next].id); }}
              style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer', padding: '4px' }}><ArrowDown size={14} /></button>
          </div>
        )}
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer', padding: '4px' }}>
          <XIcon size={16} />
        </button>
      </div>

      {/* Results dropdown */}
      {query.length >= 2 && (
        <div style={{ maxHeight: '200px', overflowY: 'auto', borderTop: '1px solid var(--mc-border)' }}>
          {searching && <div style={{ padding: '12px', textAlign: 'center', color: 'var(--mc-text-muted)', fontSize: '13px' }}>Buscando...</div>}
          {!searching && results.length === 0 && <div style={{ padding: '12px', textAlign: 'center', color: 'var(--mc-text-muted)', fontSize: '13px' }}>Sin resultados</div>}
          {results.map((r, i) => (
            <div
              key={r.id}
              onClick={() => { setActiveIdx(i); onJumpToMessage(r.id); }}
              style={{
                padding: '8px 12px', cursor: 'pointer',
                background: i === activeIdx ? 'rgba(255,255,255,0.06)' : 'transparent',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = i === activeIdx ? 'rgba(255,255,255,0.06)' : 'transparent')}
            >
              <div style={{ fontSize: '12px', color: 'var(--mc-text-muted)', marginBottom: '2px' }}>
                {r.senderName} · {new Date(r.createdAt).toLocaleDateString()}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--mc-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {highlight(r.content, query)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessageSearchBar;