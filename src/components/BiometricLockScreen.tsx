import React, { useState, useEffect, useCallback } from 'react';
import { Fingerprint, ScanFace, Lock, KeyRound } from 'lucide-react';
import { verifyBiometric, checkBiometrics, type BiometryType } from '@/services/biometric';

interface BiometricLockScreenProps {
  reason: string;
  onUnlocked: () => void;
  onPinFallback?: (pin: string) => boolean;
  showPinFallback?: boolean;
}

const ICONS: Record<BiometryType, React.ReactNode> = {
  fingerprint: <Fingerprint size={56} />,
  face: <ScanFace size={56} />,
  iris: <ScanFace size={56} />,
  none: <Lock size={56} />,
};

const LABELS: Record<BiometryType, string> = {
  fingerprint: 'Toca el sensor de huella',
  face: 'Mira hacia la camara',
  iris: 'Escaneo de iris',
  none: 'Ingresa tu PIN',
};

const BiometricLockScreen: React.FC<BiometricLockScreenProps> = ({
  reason,
  onUnlocked,
  onPinFallback,
  showPinFallback = true,
}) => {
  const [biometryType, setBiometryType] = useState<BiometryType>('none');
  const [attempting, setAttempting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [usePinMode, setUsePinMode] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    checkBiometrics().then(s => {
      setBiometryType(s.biometryType);
      if (s.isAvailable) {
        // Auto-prompt biometric on mount
        attemptBiometric();
      } else {
        setUsePinMode(true);
      }
    });
  }, []);

  const attemptBiometric = useCallback(async () => {
    setAttempting(true);
    setFailed(false);
    const ok = await verifyBiometric(reason);
    setAttempting(false);
    if (ok) {
      onUnlocked();
    } else {
      setFailed(true);
    }
  }, [reason, onUnlocked]);

  const handlePinSubmit = () => {
    setPinError('');
    if (onPinFallback) {
      const ok = onPinFallback(pin);
      if (ok) onUnlocked();
      else { setPinError('PIN incorrecto'); setPin(''); }
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '20px', color: '#e2e8f0',
    }}>
      {/* Logo */}
      <div style={{ fontSize: '28px', fontWeight: 800, color: '#10b981', letterSpacing: '-0.5px' }}>MexiChat</div>

      {!usePinMode ? (
        <>
          {/* Biometric icon */}
          <div style={{
            width: '100px', height: '100px', borderRadius: '50%',
            background: attempting ? 'rgba(16,185,129,0.15)' : failed ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: attempting ? '#10b981' : failed ? '#ef4444' : '#94a3b8',
            transition: 'all 0.3s',
            animation: attempting ? 'pulse 1.5s infinite' : 'none',
          }}>
            {ICONS[biometryType]}
          </div>

          <p style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
            {attempting ? 'Verificando...' : failed ? 'Verificacion fallida' : LABELS[biometryType]}
          </p>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, textAlign: 'center', maxWidth: '280px' }}>{reason}</p>

          {failed && (
            <button onClick={attemptBiometric}
              style={{ padding: '12px 32px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>
              Reintentar
            </button>
          )}

          {showPinFallback && (
            <button onClick={() => setUsePinMode(true)}
              style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '13px', cursor: 'pointer', marginTop: '8px' }}>
              <KeyRound size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
              Usar PIN en su lugar
            </button>
          )}
        </>
      ) : (
        <>
          {/* PIN fallback */}
          <Lock size={40} style={{ color: '#94a3b8' }} />
          <p style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Ingresa tu PIN</p>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>{reason}</p>

          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={8}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => { if (e.key === 'Enter') handlePinSubmit(); }}
            placeholder="* * * *"
            autoFocus
            style={{
              width: '180px', padding: '14px', textAlign: 'center', fontSize: '24px', letterSpacing: '8px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid #334155', borderRadius: '12px',
              color: '#e2e8f0', outline: 'none',
            }}
          />

          {pinError && <div style={{ color: '#ef4444', fontSize: '13px' }}>{pinError}</div>}

          <button onClick={handlePinSubmit}
            style={{ padding: '12px 40px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>
            Desbloquear
          </button>

          {biometryType !== 'none' && (
            <button onClick={() => { setUsePinMode(false); attemptBiometric(); }}
              style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '13px', cursor: 'pointer' }}>
              Usar biometria
            </button>
          )}
        </>
      )}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
};

export default BiometricLockScreen;