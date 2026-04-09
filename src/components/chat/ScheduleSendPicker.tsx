/**
 * MEXICHAT — ScheduleSendPicker
 * Long-press or right-click the send button to schedule.
 */
import React, { useState } from 'react';
import { Clock, Calendar, X, Send } from 'lucide-react';

interface ScheduleSendPickerProps {
  open: boolean;
  onClose: () => void;
  onSchedule: (sendAt: Date) => void;
}

const quickOpts = [
  { label: 'En 1 hora', hours: 1, emoji: '🕐' },
  { label: 'En 3 horas', hours: 3, emoji: '🕒' },
  { label: 'Manana 9am', hours: -1, emoji: '🌅' },
  { label: 'Manana 6pm', hours: -2, emoji: '🌆' },
];

function getTomorrow(hour: number): Date {
  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(hour, 0, 0, 0); return d;
}

const ScheduleSendPicker: React.FC<ScheduleSendPickerProps> = ({ open, onClose, onSchedule }) => {
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  if (!open) return null;

  const handleQuick = (hours: number) => {
    let d: Date;
    if (hours === -1) d = getTomorrow(9);
    else if (hours === -2) d = getTomorrow(18);
    else d = new Date(Date.now() + hours * 3600000);
    onSchedule(d); onClose();
  };

  const handleCustom = () => {
    if (!dateStr || !timeStr) return;
    const d = new Date(`${dateStr}T${timeStr}:00`);
    if (d.getTime() <= Date.now()) return;
    onSchedule(d); onClose();
  };

  return (
    <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '8px', background: '#fff',
      borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
      width: '260px', zIndex: 50, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
          <Send size={15} style={{ color: '#1d4ed8' }} /> Enviar despues
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={16} /></button>
      </div>
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {quickOpts.map(o => (
          <button key={o.label} onClick={() => handleQuick(o.hours)}
            style={{ padding: '10px 12px', background: '#f8fafc', border: '1px solid transparent', borderRadius: '8px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px',
              color: '#0f172a', fontWeight: 500, transition: 'all 0.15s', textAlign: 'left' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(29,78,216,0.06)'; e.currentTarget.style.borderColor = '#1d4ed8'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = 'transparent'; }}>
            <span style={{ fontSize: '16px' }}>{o.emoji}</span> {o.label}
          </button>
        ))}
        <button onClick={() => setShowCustom(!showCustom)}
          style={{ padding: '10px 12px', background: showCustom ? 'rgba(29,78,216,0.06)' : '#f8fafc',
            border: `1px solid ${showCustom ? '#1d4ed8' : 'transparent'}`, borderRadius: '8px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px',
            color: '#0f172a', fontWeight: 500 }}>
          <Calendar size={16} style={{ color: '#1d4ed8' }} /> Personalizar
        </button>
        {showCustom && (
          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
            <input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
            <input type="time" value={timeStr} onChange={e => setTimeStr(e.target.value)}
              style={{ width: '90px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
            <button onClick={handleCustom}
              style={{ padding: '6px 10px', background: '#1d4ed8', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}>
              OK
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScheduleSendPicker;