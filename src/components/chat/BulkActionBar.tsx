import React from 'react';
import { Trash2, CornerUpRight, Copy, X } from 'lucide-react';

interface BulkActionBarProps {
  selectedCount: number;
  onDelete: () => void;
  onForward: () => void;
  onCopy: () => void;
  onCancel: () => void;
}

const BulkActionBar: React.FC<BulkActionBarProps> = ({ selectedCount, onDelete, onForward, onCopy, onCancel }) => {
  if (selectedCount === 0) return null;

  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
    background: 'rgba(255,255,255,0.08)', border: '1px solid var(--mc-border)',
    borderRadius: '8px', color: 'var(--mc-text)', fontSize: '13px', cursor: 'pointer', fontWeight: 600,
  };

  return (
    <div style={{
      padding: '10px 16px', background: 'var(--mc-sidebar)',
      borderTop: '1px solid var(--mc-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <span style={{ fontSize: '13px', color: 'var(--mc-text-muted)', fontWeight: 600 }}>
        {selectedCount} seleccionado{selectedCount > 1 ? 's' : ''}
      </span>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={onCopy} style={btnStyle}><Copy size={14} /> Copiar</button>
        <button onClick={onForward} style={btnStyle}><CornerUpRight size={14} /> Reenviar</button>
        <button onClick={onDelete} style={{ ...btnStyle, background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}><Trash2 size={14} /> Eliminar</button>
        <button onClick={onCancel} style={{ ...btnStyle, padding: '8px 10px' }}><X size={14} /></button>
      </div>
    </div>
  );
};

export default BulkActionBar;