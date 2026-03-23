import React, { useState } from 'react';
import { Lock, ShieldCheck, X } from 'lucide-react';

interface EncryptionBadgeProps {
  isEncrypted: boolean;
}

const EncryptionBadge: React.FC<EncryptionBadgeProps> = ({ isEncrypted }) => {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <>
      <button onClick={() => setShowInfo(true)} title={isEncrypted ? 'Cifrado de extremo a extremo' : 'Sin cifrar'} style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
        color: isEncrypted ? '#22c55e' : 'var(--mc-text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px',
      }}>
        <Lock size={12} />
        {isEncrypted ? 'E2EE' : ''}
      </button>
      {showInfo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowInfo(false); }}>
          <div style={{ background: 'var(--mc-sidebar)', borderRadius: '12px', maxWidth: '360px', padding: '24px', border: '1px solid var(--mc-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={20} style={{ color: isEncrypted ? '#22c55e' : '#ef4444' }} />
                <span style={{ fontWeight: 700, color: 'var(--mc-text)' }}>{isEncrypted ? 'Cifrado activo' : 'Sin cifrar'}</span>
              </div>
              <button onClick={() => setShowInfo(false)} style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--mc-text-muted)', lineHeight: 1.6, margin: 0 }}>
              {isEncrypted
                ? 'Los mensajes en esta conversacion estan protegidos con cifrado de extremo a extremo (ECDH + AES-256-GCM). Ni el servidor ni terceros pueden leer su contenido.'
                : 'Esta conversacion no tiene cifrado de extremo a extremo. El otro usuario necesita actualizar su perfil para activar E2EE.'}
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default EncryptionBadge;