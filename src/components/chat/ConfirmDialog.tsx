import React from 'react';
import { X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_COLORS = {
  danger: { bg: '#ef4444', hover: '#dc2626' },
  warning: { bg: '#f59e0b', hover: '#d97706' },
  info: { bg: 'var(--mc-blue)', hover: 'var(--mc-blue-dark, #b91c3c)' },
};

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open, title, description, confirmText = 'Confirmar',
  cancelText = 'Cancelar', variant = 'danger', onConfirm, onCancel,
}) => {
  if (!open) return null;
  const colors = VARIANT_COLORS[variant];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{ background: 'var(--mc-sidebar)', borderRadius: '12px', width: '100%', maxWidth: '380px', padding: '24px', border: '1px solid var(--mc-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--mc-text)' }}>{title}</h3>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer', padding: '4px' }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: '14px', color: 'var(--mc-text-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>{description}</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--mc-border)', borderRadius: '8px', color: 'var(--mc-text)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            {cancelText}
          </button>
          <button onClick={onConfirm} style={{ padding: '8px 16px', background: colors.bg, border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;