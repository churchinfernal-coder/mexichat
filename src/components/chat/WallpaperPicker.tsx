/**
 * MEXICHAT — WallpaperPicker (per-chat)
 * Shows preset wallpapers + custom color. Applied per conversation/group.
 */
import React, { useState } from 'react';
import { Image as ImageIcon, X, Check, RotateCcw } from 'lucide-react';

const PRESETS = [
  { id: 'none', label: 'Sin fondo', value: '', preview: '#f8fafc' },
  { id: 'dark', label: 'Oscuro', value: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', preview: '#1a1a2e' },
  { id: 'midnight', label: 'Medianoche', value: 'linear-gradient(180deg, #0d0d0d 0%, #1a0000 100%)', preview: '#0d0d0d' },
  { id: 'forest', label: 'Bosque', value: 'linear-gradient(180deg, #0a0a0a 0%, #001a0a 100%)', preview: '#001a0a' },
  { id: 'ocean', label: 'Oceano', value: 'linear-gradient(180deg, #0c1426 0%, #1a3a5c 100%)', preview: '#1a3a5c' },
  { id: 'sunset', label: 'Atardecer', value: 'linear-gradient(180deg, #1a0a2e 0%, #2d1b00 100%)', preview: '#2d1b00' },
  { id: 'rose', label: 'Rosa', value: 'linear-gradient(180deg, #2d1b2e 0%, #1a0a1a 100%)', preview: '#2d1b2e' },
  { id: 'mint', label: 'Menta', value: 'linear-gradient(180deg, #e0f7f0 0%, #d0ece7 100%)', preview: '#d0ece7' },
  { id: 'cream', label: 'Crema', value: 'linear-gradient(180deg, #fef9ef 0%, #fdf0d5 100%)', preview: '#fdf0d5' },
  { id: 'sky', label: 'Cielo', value: 'linear-gradient(180deg, #e3f2fd 0%, #bbdefb 100%)', preview: '#bbdefb' },
];

interface WallpaperPickerProps {
  open: boolean;
  onClose: () => void;
  currentValue: string | null;
  onSelect: (value: string) => void;
  onRemove: () => void;
}

const WallpaperPicker: React.FC<WallpaperPickerProps> = ({ open, onClose, currentValue, onSelect, onRemove }) => {
  const [customColor, setCustomColor] = useState('#1a1a2e');

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '360px', border: '1px solid #e2e8f0', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
            <ImageIcon size={18} style={{ color: '#1d4ed8' }} /> Fondo del chat
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
          {PRESETS.map(p => {
            const isActive = currentValue === p.value || (!currentValue && p.id === 'none');
            return (
              <button key={p.id} onClick={() => p.value ? onSelect(p.value) : onRemove()}
                style={{
                  width: '100%', aspectRatio: '1', borderRadius: '12px', border: isActive ? '3px solid #1d4ed8' : '2px solid #e2e8f0',
                  background: p.value || p.preview, cursor: 'pointer', position: 'relative', transition: 'all 0.15s',
                }}
                title={p.label}>
                {isActive && (
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(29,78,216,0.3)' }}>
                    <Check size={18} style={{ color: 'white' }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
        {/* Custom color */}
        <div style={{ padding: '0 16px 16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="color" value={customColor} onChange={e => setCustomColor(e.target.value)}
            style={{ width: '36px', height: '36px', border: '2px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', padding: 0 }} />
          <button onClick={() => onSelect(customColor)}
            style={{ flex: 1, padding: '8px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
            Usar color personalizado
          </button>
          {currentValue && (
            <button onClick={onRemove} title="Quitar fondo"
              style={{ padding: '8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', color: '#ef4444' }}>
              <RotateCcw size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WallpaperPicker;