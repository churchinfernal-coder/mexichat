import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

const CATEGORIES = [
  { id: 'spam', label: 'Spam' },
  { id: 'harassment', label: 'Acoso' },
  { id: 'fake', label: 'Perfil falso' },
  { id: 'underage', label: 'Menor de edad' },
  { id: 'scam', label: 'Estafa' },
  { id: 'other', label: 'Otro' },
];

interface ReportDialogProps {
  open: boolean;
  userName: string;
  onSubmit: (category: string, reason: string) => void;
  onCancel: () => void;
}

const ReportDialog: React.FC<ReportDialogProps> = ({ open, userName, onSubmit, onCancel }) => {
  const [category, setCategory] = useState('');
  const [reason, setReason] = useState('');

  if (!open) return null;

  const handleSubmit = () => {
    if (!category) return;
    onSubmit(category, reason);
    setCategory('');
    setReason('');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{ background: 'var(--mc-sidebar)', borderRadius: '12px', width: '100%', maxWidth: '420px', padding: '24px', border: '1px solid var(--mc-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} style={{ color: '#ef4444' }} />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--mc-text)' }}>Reportar a {userName}</h3>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setCategory(c.id)} style={{
              padding: '10px 14px', background: category === c.id ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
              border: category === c.id ? '1px solid #ef4444' : '1px solid var(--mc-border)',
              borderRadius: '8px', color: 'var(--mc-text)', fontSize: '13px', cursor: 'pointer', textAlign: 'left',
            }}>{c.label}</button>
          ))}
        </div>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
          placeholder="Detalles adicionales (opcional)..."
          style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--mc-border)', borderRadius: '8px', color: 'var(--mc-text)', fontSize: '13px', resize: 'none', fontFamily: 'inherit', outline: 'none', marginBottom: '16px', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--mc-border)', borderRadius: '8px', color: 'var(--mc-text)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSubmit} disabled={!category} style={{
            padding: '8px 16px', background: category ? '#ef4444' : '#555', border: 'none', borderRadius: '8px',
            color: 'white', fontSize: '13px', fontWeight: 600, cursor: category ? 'pointer' : 'not-allowed', opacity: category ? 1 : 0.5,
          }}>Reportar y Bloquear</button>
        </div>
      </div>
    </div>
  );
};

export default ReportDialog;