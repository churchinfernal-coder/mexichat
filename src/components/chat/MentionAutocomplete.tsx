import React from 'react';
import { User } from 'lucide-react';
import type { MentionSuggestion } from '@/hooks/useMentions';

export interface MentionAutocompleteProps {
  suggestions: MentionSuggestion[];
  activeIndex: number;
  onSelect: (suggestion: MentionSuggestion) => void;
}

const MentionAutocomplete: React.FC<MentionAutocompleteProps> = ({ suggestions, activeIndex, onSelect }) => {
  if (!suggestions.length) return null;

  return (
    <div style={{
      position: 'absolute', bottom: '100%', left: '12px', right: '12px',
      marginBottom: '4px', background: 'var(--mc-sidebar)', borderRadius: '8px',
      border: '1px solid var(--mc-border)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      maxHeight: '200px', overflowY: 'auto', zIndex: 50,
    }}>
      {suggestions.map((s, i) => (
        <div
          key={s.userId}
          onClick={() => onSelect(s)}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '8px 12px', cursor: 'pointer',
            background: i === activeIndex ? 'rgba(255,255,255,0.08)' : 'transparent',
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = i === activeIndex ? 'rgba(255,255,255,0.08)' : 'transparent')}
        >
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
            background: 'var(--mc-sidebar-active)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', overflow: 'hidden',
          }}>
            {s.avatarUrl ? (
              <img src={s.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <User size={14} style={{ color: 'var(--mc-text-muted)' }} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--mc-text)' }}>{s.displayName}</div>
            {s.username && (
              <div style={{ fontSize: '11px', color: 'var(--mc-text-muted)' }}>@{s.username}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MentionAutocomplete;