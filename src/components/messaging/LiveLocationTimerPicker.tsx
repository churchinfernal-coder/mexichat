import { X, Clock, Navigation } from 'lucide-react';

export interface LiveDurationOption {
  label: string;
  minutes: number;
}

export const LIVE_DURATION_OPTIONS: LiveDurationOption[] = [
  { label: '15 minutos', minutes: 15 },
  { label: '30 minutos', minutes: 30 },
  { label: '1 hora', minutes: 60 },
  { label: '2 horas', minutes: 120 },
  { label: '8 horas', minutes: 480 },
];

interface LiveLocationTimerPickerProps {
  open: boolean;
  onSelect: (minutes: number) => void;
  onClose: () => void;
}

export default function LiveLocationTimerPicker({ open, onSelect, onClose }: LiveLocationTimerPickerProps) {
  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div style={{ background: 'var(--mc-bg, #fff)', borderRadius: '12px', width: '300px', maxWidth: '90vw', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--mc-border, #eee)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Navigation size={20} style={{ color: 'var(--mc-blue, #0088cc)' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '15px' }}>Ubicacion en tiempo real</div>
              <div style={{ fontSize: '12px', color: 'var(--mc-text-muted, #888)', marginTop: '2px' }}>Selecciona la duracion</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}><X size={20} /></button>
        </div>
        <div style={{ padding: '8px 0' }}>
          {LIVE_DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.minutes}
              onClick={() => onSelect(opt.minutes)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: '14px', color: 'var(--mc-text, #333)', textAlign: 'left',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--mc-bg-hover, #f0f0f0)'; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'none'; }}
            >
              <Clock size={18} style={{ color: 'var(--mc-blue, #0088cc)', flexShrink: 0 }} />
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--mc-border, #eee)', fontSize: '11px', color: 'var(--mc-text-muted, #888)', lineHeight: '1.4' }}>
          Los participantes veran tu ubicacion en el mapa durante el tiempo seleccionado.
        </div>
      </div>
    </div>
  );
}