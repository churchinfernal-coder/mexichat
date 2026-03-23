import React, { useState } from 'react';
import { Lock, Shield } from 'lucide-react';


export interface ChatLockScreenProps {
  onUnlock: (pin: string) => boolean;
  mode: 'unlock' | 'setup';
  onSetup?: (pin: string) => boolean;
}

const ChatLockScreen: React.FC<ChatLockScreenProps> = ({ onUnlock, mode, onSetup }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    setError('');
    if (mode === 'unlock') {
      const success = onUnlock(pin);
      if (!success) { setError('PIN incorrecto'); setPin(''); }
    } else {
      if (step === 'enter') {
        if (pin.length < 4) { setError('Mínimo 4 dígitos'); return; }
        setStep('confirm');
      } else {
        if (pin !== confirmPin) { setError('Los PINs no coinciden'); setConfirmPin(''); return; }
        onSetup?.(pin);
      }
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--mc-chat-bg)', zIndex: 200,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px',
    }}>
      <Shield size={48} style={{ color: 'var(--mc-blue)' }} />
      <Lock size={32} style={{ color: 'var(--mc-blue)' }} />
      <h2 style={{ color: 'var(--mc-text)', fontSize: '20px', fontWeight: 700, margin: 0 }}>
        {mode === 'unlock' ? 'Chat Bloqueado' : step === 'enter' ? 'Crear PIN' : 'Confirmar PIN'}
      </h2>
      <p style={{ color: 'var(--mc-text-muted)', fontSize: '14px', margin: 0 }}>
        {mode === 'unlock' ? 'Ingresa tu PIN para acceder' : step === 'enter' ? 'Elige un PIN de al menos 4 dígitos' : 'Ingresa el PIN nuevamente'}
      </p>

      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={8}
          value={step === 'confirm' ? confirmPin : pin}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '');
            if (step === 'confirm') setConfirmPin(val);
            else setPin(val);
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          placeholder="• • • •"
          autoFocus
          style={{
            width: '180px', padding: '14px', textAlign: 'center', fontSize: '24px', letterSpacing: '8px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--mc-border)', borderRadius: '12px',
            color: 'var(--mc-text)', outline: 'none',
          }}
        />
      </div>

      {error && <div style={{ color: '#ef4444', fontSize: '13px' }}>{error}</div>}

      <button
        onClick={handleSubmit}
        style={{
          padding: '12px 40px', background: 'var(--mc-blue)', border: 'none', borderRadius: '8px',
          color: 'white', fontWeight: 700, fontSize: '15px', cursor: 'pointer',
        }}
      >
        {mode === 'unlock' ? 'Desbloquear' : step === 'enter' ? 'Siguiente' : 'Confirmar'}
      </button>
    </div>
  );
};

export default ChatLockScreen;