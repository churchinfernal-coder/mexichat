import React, { useState } from 'react';
import { SmilePlus } from 'lucide-react';

var QUICK_REACTIONS = ['\uD83D\uDC4D', '\u2764\uFE0F', '\uD83D\uDE02', '\uD83D\uDE2E', '\uD83D\uDE22', '\uD83D\uDD25', '\uD83D\uDE4F', '\uD83D\uDC4F'];
var FULL_EMOJI_SET = [
  '\uD83D\uDC4D', '\uD83D\uDC4E', '\u2764\uFE0F', '\uD83D\uDD25', '\uD83D\uDE02', '\uD83D\uDE2E', '\uD83D\uDE22', '\uD83D\uDE21', '\uD83D\uDE4F', '\uD83D\uDC4F',
  '\uD83C\uDF89', '\uD83D\uDC80', '\uD83E\uDD14', '\uD83D\uDE0D', '\uD83E\uDD29', '\uD83E\uDD70', '\uD83D\uDE18', '\uD83D\uDE0F', '\u2B50', '\uD83D\uDCAA',
  '\uD83E\uDEF6', '\uD83D\uDCAF', '\u2728', '\uD83E\uDD73', '\uD83E\uDD2D', '\uD83E\uDD75', '\uD83D\uDE1C', '\uD83E\uDEE1', '\uD83D\uDE07', '\uD83E\uDD19',
];

export interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  position?: 'above' | 'below';
}

var ReactionPicker: React.FC<ReactionPickerProps> = function({ onSelect, position }) {
  if (!position) position = 'above';
  var _a = useState(false), showFull = _a[0], setShowFull = _a[1];

  var posStyle = position === 'above'
    ? { bottom: '100%', marginBottom: '8px' }
    : { top: '100%', marginTop: '8px' };

  return (
    <div style={{ position: 'absolute', ...posStyle, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
      <div style={{
        background: 'var(--mc-sidebar, #ffffff)',
        borderRadius: '28px',
        padding: showFull ? '12px' : '8px 12px',
        border: '1px solid var(--mc-border, #e2e8f0)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        display: 'flex',
        flexWrap: showFull ? 'wrap' : 'nowrap',
        gap: showFull ? '4px' : '2px',
        maxWidth: showFull ? '320px' : 'none',
        justifyContent: 'center',
      }}>
        {(showFull ? FULL_EMOJI_SET : QUICK_REACTIONS).map(function(emoji) {
          return (
            <button
              key={emoji}
              onClick={function(e) { e.stopPropagation(); onSelect(emoji); }}
              style={{
                width: '44px',
                height: '44px',
                minWidth: '44px',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '24px',
                transition: 'transform 0.12s ease, background 0.15s ease',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
                padding: 0,
              }}
              onMouseEnter={function(e) { e.currentTarget.style.transform = 'scale(1.25)'; e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; }}
              onMouseLeave={function(e) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'none'; }}
            >
              {emoji}
            </button>
          );
        })}
        {!showFull && (
          <button
            onClick={function(e) { e.stopPropagation(); setShowFull(true); }}
            style={{
              width: '44px',
              height: '44px',
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              color: 'var(--mc-text-muted, #94a3b8)',
              touchAction: 'manipulation',
              padding: 0,
            }}
            title="Mas emojis"
          >
            <SmilePlus size={22} />
          </button>
        )}
      </div>
    </div>
  );
};

export default ReactionPicker;