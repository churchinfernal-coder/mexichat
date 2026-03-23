import React from 'react';
import type { Reaction } from '@/hooks/useMessageReactions';

export interface ReactionBadgeProps {
  reactions: Reaction[];
  onToggle: (emoji: string) => void;
}

const ReactionBadge: React.FC<ReactionBadgeProps> = ({ reactions, onToggle }) => {
  if (!reactions || reactions.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={(e) => { e.stopPropagation(); onToggle(r.emoji); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '2px 8px', borderRadius: '12px', fontSize: '13px',
            background: r.hasReacted ? 'rgba(var(--mc-blue-rgb, 220,38,38), 0.15)' : 'rgba(255,255,255,0.06)',
            border: r.hasReacted ? '1px solid rgba(var(--mc-blue-rgb, 220,38,38), 0.3)' : '1px solid var(--mc-border)',
            cursor: 'pointer', color: 'var(--mc-text)', transition: 'all 0.15s',
          }}
        >
          <span>{r.emoji}</span>
          <span style={{ fontSize: '11px', fontWeight: 600 }}>{r.count}</span>
        </button>
      ))}
    </div>
  );
};

export default ReactionBadge;