import React, { useState } from 'react';
import { X } from 'lucide-react';

const CATEGORIES: { name: string; emojis: string[] }[] = [
  { name: 'Caras', emojis: ['😀','😂','🥰','😍','😘','😜','🤪','😎','🥳','😢','😭','😤','🥵','🥶','😱','🤮','🤯','😈','👻','💀','🤡','👽'] },
  { name: 'Gestos', emojis: ['👍','👎','👊','✊','🤞','✌️','🤟','🤙','👋','🙏','💪','👏','🤝','💅','🫶'] },
  { name: 'Corazones', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💕','💞','💓','💗','💖','💘','💝','💔','❤️‍🔥'] },
  { name: 'Objetos', emojis: ['🔥','⭐','🌟','💫','✨','🎉','🎊','🎁','🏆','💰','💎','🔒','🔑','💡','📱','💻'] },
  { name: 'Comida', emojis: ['🍕','🍔','🌮','🍣','🍩','🍪','🎂','🍫','🍷','🍺','☕','🧋'] },
  { name: 'Naturaleza', emojis: ['🌹','🌸','🌺','🌻','🌴','🌙','⭐','🌈','🦋','🐱','🐶'] },
  { name: 'Sexy', emojis: ['💋','👄','👅','🍑','🍆','🍒','🍓','💦','🔥','😏','🥂','🛏️','💃','🩱','👙','🌹','💄','🫦'] },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, onClose }) => {
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <div style={{
      position: 'absolute', bottom: '60px', left: '10px', width: '320px', maxHeight: '360px',
      background: 'var(--mc-sidebar)', border: '1px solid var(--mc-border)', borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', zIndex: 50, overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--mc-border)' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--mc-text)' }}>Emojis</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer', padding: '2px', display: 'flex' }}><X size={16} /></button>
      </div>
      <div style={{ display: 'flex', gap: '2px', padding: '6px 8px', borderBottom: '1px solid var(--mc-border)', overflowX: 'auto' }}>
        {CATEGORIES.map((cat, i) => (
          <button key={cat.name} onClick={() => setActiveCategory(i)} style={{
            padding: '4px 8px', fontSize: '11px', borderRadius: '6px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            background: i === activeCategory ? 'var(--mc-blue)' : 'transparent',
            color: i === activeCategory ? 'white' : 'var(--mc-text-muted)', fontWeight: 600,
          }}>{cat.name}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '2px' }}>
        {CATEGORIES[activeCategory].emojis.map((emoji, i) => (
          <button key={`${emoji}-${i}`} onClick={() => onSelect(emoji)} style={{
            background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', padding: '4px',
            borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EmojiPicker;