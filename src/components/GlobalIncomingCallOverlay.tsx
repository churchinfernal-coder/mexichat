/**
 * GlobalIncomingCallOverlay v3
 * 
 * Receives accept/reject functions as PROPS from CallManager.
 * Does NOT call useGlobalCallManager — avoids hooks order mismatch.
 */

import React from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useCallContext, type IncomingCallSignal } from '@/contexts/CallContext';

interface GlobalIncomingCallOverlayProps {
  onAccept: (incoming: IncomingCallSignal) => Promise<MediaStream | undefined>;
  onReject: (incoming: IncomingCallSignal) => Promise<void>;
}

const GlobalIncomingCallOverlay: React.FC<GlobalIncomingCallOverlayProps> = ({ onAccept, onReject }) => {
  const { incomingCall, activeCall } = useCallContext();

  if (!incomingCall || activeCall?.active) return null;

  const handleAccept = async () => {
    try {
      console.log('[IncomingCallOverlay] Accept clicked');
      await onAccept(incomingCall);
    } catch (err) {
      console.error('[IncomingCallOverlay] Accept failed:', err);
    }
  };

  const handleReject = async () => {
    try {
      console.log('[IncomingCallOverlay] Reject clicked');
      await onReject(incomingCall);
    } catch (err) {
      console.error('[IncomingCallOverlay] Reject failed:', err);
    }
  };

  return (
    <div
      role="alertdialog"
      aria-label="Llamada entrante"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999,
        background: 'linear-gradient(135deg, #0a0a1a 0%, #1a0a15 50%, #0a0a1a 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '28px',
      }}
    >
      {/* Avatar */}
      <div style={{
        width: '130px', height: '130px', borderRadius: '50%',
        background: 'rgba(217,38,73,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '44px', fontWeight: 700, color: 'white', overflow: 'hidden',
        animation: 'mc-call-pulse 1.5s ease-out infinite',
      }}>
        {incomingCall.avatarUrl ? (
          <img src={incomingCall.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          incomingCall.callerName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
        )}
      </div>

      {/* Caller Info */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '26px', fontWeight: 700, color: 'white', marginBottom: '10px', letterSpacing: '-0.5px' }}>
          {incomingCall.callerName}
        </div>
        <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          {incomingCall.callType === 'video'
            ? <><Video size={20} /> Videollamada entrante...</>
            : <><Phone size={20} /> Llamada de voz entrante...</>
          }
        </div>
      </div>

      {/* Accept / Reject Buttons */}
      <div style={{ display: 'flex', gap: '48px', marginTop: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleReject}
            aria-label="Rechazar llamada"
            style={{
              width: '72px', height: '72px', borderRadius: '50%', background: '#ef4444',
              border: 'none', color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 24px rgba(239,68,68,0.5)',
            }}
          >
            <PhoneOff size={30} />
          </button>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Rechazar</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleAccept}
            aria-label="Aceptar llamada"
            style={{
              width: '72px', height: '72px', borderRadius: '50%', background: '#22c55e',
              border: 'none', color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 24px rgba(34,197,94,0.5)',
              animation: 'mc-accept-bounce 2s ease-in-out infinite',
            }}
          >
            <Phone size={30} />
          </button>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Aceptar</span>
        </div>
      </div>

      {/* Branding */}
      <div style={{ position: 'absolute', bottom: '24px', fontSize: '12px', color: 'rgba(255,255,255,0.15)', fontWeight: 600, letterSpacing: '1px' }}>
        MEXICHAT
      </div>

      <style>{`
        @keyframes mc-call-pulse { 0% { box-shadow: 0 0 0 0 rgba(29,78,216,0.5); } 70% { box-shadow: 0 0 0 30px rgba(29,78,216,0); } 100% { box-shadow: 0 0 0 0 rgba(29,78,216,0); } }
        @keyframes mc-accept-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
      `}</style>
    </div>
  );
};

export default GlobalIncomingCallOverlay;