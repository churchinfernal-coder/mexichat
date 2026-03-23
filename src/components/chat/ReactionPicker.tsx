import React, { useState } from 'react';
import { SmilePlus } from 'lucide-react';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🙏', '👏'];
const FULL_EMOJI_SET = [
  '👍', '👎', '❤️', '🔥', '😂', '😮', '😢', '😡', '🙏', '👏',
  '🎉', '💀', '🤔', '😍', '🤩', '🥰', '😘', '😏', '🤤', '😈',
  '💯', '✨', '💋', '🍑', '🍆', '💦', '🌶️', '😜', '🤫', '🥵',
];

export interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  position?: 'above' | 'below';
}

const ReactionPicker: React.FC<ReactionPickerProps> = ({ onSelect, position = 'above' }) => {
  const [showFull, setShowFull] = useState(false);

  const posStyle = position === 'above'
    ? { bottom: '100%', marginBottom: '6px' }
    : { top: '100%', marginTop: '6px' };

  return (
    <div style={{ position: 'absolute', ...posStyle, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
      <div style={{
        background: 'var(--mc-sidebar)', borderRadius: '24px', padding: showFull ? '10px' : '6px 10px',
        border: '1px solid var(--mc-border)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        display: 'flex', flexWrap: showFull ? 'wrap' : 'nowrap', gap: '2px',
        maxWidth: showFull ? '260px' : 'none', justifyContent: 'center',
      }}>
        {(showFull ? FULL_EMOJI_SET : QUICK_REACTIONS).map((emoji) => (
          <button
            key={emoji}
            onClick={(e) => { e.stopPropagation(); onSelect(emoji); }}
            style={{
              width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: '18px',
              transition: 'transform 0.1s, background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.3)'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'none'; }}
          >
            {emoji}
          </button>
        ))}
        {!showFull && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowFull(true); }}
            style={{
              width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', borderRadius: '50%', cursor: 'pointer', color: 'var(--mc-text-muted)',
            }}
            title="Más emojis"
          >
            <SmilePlus size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default ReactionPicker;