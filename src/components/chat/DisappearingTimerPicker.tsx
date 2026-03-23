import React from 'react';
import { Timer, X } from 'lucide-react';

type DisappearTimer = 'off' | '5m' | '1h' | '24h' | '7d';

const OPTIONS: { value: DisappearTimer; label: string }[] = [
  { value: 'off', label: 'Desactivado' },
  { value: '5m', label: '5 minutos' },
  { value: '1h', label: '1 hora' },
  { value: '24h', label: '24 horas' },
  { value: '7d', label: '7 dias' },
];

interface DisappearingTimerPickerProps {
  open: boolean;
  currentTimer: DisappearTimer;
  onChange: (timer: DisappearTimer) => void;
  onClose: () => void;
}

const DisappearingTimerPicker: React.FC<DisappearingTimerPickerProps> = ({ open, currentTimer, onChange, onClose }) => {
  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--mc-sidebar)', borderRadius: '12px', width: '100%', maxWidth: '320px', padding: '20px', border: '1px solid var(--mc-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Timer size={16} style={{ color: 'var(--mc-blue)' }} />
            <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--mc-text)' }}>Mensajes temporales</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {OPTIONS.map(o => (
            <button key={o.value} onClick={() => { onChange(o.value); onClose(); }} style={{
              padding: '10px 14px', background: currentTimer === o.value ? 'rgba(217,38,73,0.15)' : 'rgba(255,255,255,0.04)',
              border: currentTimer === o.value ? '1px solid var(--mc-blue)' : '1px solid var(--mc-border)',
              borderRadius: '8px', color: 'var(--mc-text)', fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontWeight: currentTimer === o.value ? 700 : 400,
            }}>{o.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DisappearingTimerPicker;