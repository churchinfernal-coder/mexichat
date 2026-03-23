import React from 'react';
import { Pin, ChevronDown, X as XIcon } from 'lucide-react';
import type { PinnedMessage } from '@/hooks/usePinnedMessages';

export interface PinnedMessageBarProps {
  pinnedMessages: PinnedMessage[];
  onJumpToMessage: (messageId: string) => void;
  onShowAll: () => void;
  onUnpin?: (pinId: string) => void;
  canUnpin?: boolean;
}

const PinnedMessageBar: React.FC<PinnedMessageBarProps> = ({ pinnedMessages, onJumpToMessage, onShowAll, onUnpin, canUnpin }) => {
  if (!pinnedMessages.length) return null;

  const latest = pinnedMessages[0];

  return (
    <div
      onClick={() => onJumpToMessage(latest.messageId)}
      style={{
        padding: '8px 12px', borderBottom: '1px solid var(--mc-border)',
        background: 'rgba(255,255,255,0.02)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: '8px',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
    >
      <Pin size={14} style={{ color: 'var(--mc-blue)', flexShrink: 0, transform: 'rotate(45deg)' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '11px', color: 'var(--mc-blue)', fontWeight: 600 }}>
          Mensaje fijado {pinnedMessages.length > 1 ? `(${pinnedMessages.length})` : ''}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--mc-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {latest.content || '📎 Archivo'}
        </div>
      </div>
      {pinnedMessages.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onShowAll(); }}
          style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer', padding: '4px' }}
          title="Ver todos los fijados"
        >
          <ChevronDown size={14} />
        </button>
      )}
      {canUnpin && onUnpin && (
        <button
          onClick={(e) => { e.stopPropagation(); onUnpin(latest.id); }}
          style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer', padding: '4px' }}
          title="Desfijar"
        >
          <XIcon size={14} />
        </button>
      )}
    </div>
  );
};

export default PinnedMessageBar;