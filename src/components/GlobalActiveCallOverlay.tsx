/**
 * GlobalActiveCallOverlay v3
 * 
 * Shows active call UI. Receives control functions as PROPS from CallManager.
 * Does NOT call useGlobalCallManager — avoids hooks order mismatch.
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { useCallContext } from '@/contexts/CallContext';
import { webRTCService } from '@/lib/webrtc-service';

interface GlobalActiveCallOverlayProps {
  onEndCall: () => Promise<void>;
  onToggleMute: () => void;
  onToggleVideo: () => void;
}

function formatCallDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const GlobalActiveCallOverlay: React.FC<GlobalActiveCallOverlayProps> = ({
  onEndCall,
  onToggleMute,
  onToggleVideo,
}) => {
  const { activeCall } = useCallContext();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [hasRemoteStream, setHasRemoteStream] = useState(false);

  // Attach local stream
  useEffect(() => {
    if (!activeCall?.active) return;
    const stream = webRTCService.getLocalStream();
    if (stream && localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [activeCall?.active, activeCall?.callId]);

  // Poll for remote stream (it arrives asynchronously via ontrack)
  useEffect(() => {
    if (!activeCall?.active) return;

    const checkRemote = setInterval(() => {
      const remote = webRTCService.getRemoteStream(activeCall.callId);
      if (remote && remote.getTracks().length > 0) {
        setHasRemoteStream(true);

        if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== remote) {
          remoteVideoRef.current.srcObject = remote;
          remoteVideoRef.current.muted = false;
          remoteVideoRef.current.volume = 1.0;
          remoteVideoRef.current.play().catch(() => {});
        }

        if (remoteAudioRef.current && remoteAudioRef.current.srcObject !== remote) {
          remoteAudioRef.current.srcObject = remote;
          remoteAudioRef.current.muted = false;
          remoteAudioRef.current.volume = 1.0;
          remoteAudioRef.current.play().catch(() => {});
        }
      }
    }, 500);

    return () => clearInterval(checkRemote);
  }, [activeCall?.active, activeCall?.callId, activeCall?.status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
      setHasRemoteStream(false);
    };
  }, []);

  if (!activeCall?.active) return null;

  const isVideo = activeCall.type === 'video';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99998,
      background: isVideo ? '#000' : 'linear-gradient(135deg, #0a0a1a 0%, #1a0a15 50%, #0a0a1a 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Hidden audio element — ensures audio always plays even in audio-only calls */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      {isVideo ? (
        <>
          {/* Remote video — main view */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              position: 'absolute', inset: 0, background: '#111',
              display: hasRemoteStream ? 'block' : 'none',
            }}
          />

          {/* Placeholder when no remote video yet */}
          {!hasRemoteStream && (
            <div style={{ textAlign: 'center', zIndex: 2, color: 'white' }}>
              <div style={{
                width: '100px', height: '100px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px', fontSize: '36px', fontWeight: 700,
              }}>
                {activeCall.peerId.charAt(0).toUpperCase()}
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
                {activeCall.status === 'calling' && '📞 Llamando...'}
                {activeCall.status === 'ringing' && '🔔 Conectando...'}
                {activeCall.status === 'connected' && `⏱️ ${formatCallDuration(activeCall.duration)}`}
              </div>
            </div>
          )}

          {/* Local video — PiP */}
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              position: 'absolute', bottom: '100px', right: '16px',
              width: '140px', height: '190px', borderRadius: '12px',
              objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)',
              zIndex: 2, background: '#222',
            }}
          />

          {/* Duration overlay when connected */}
          {activeCall.status === 'connected' && hasRemoteStream && (
            <div style={{
              position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.5)', borderRadius: '20px', padding: '6px 16px',
              color: 'white', fontSize: '14px', fontWeight: 600, zIndex: 3,
            }}>
              ⏱️ {formatCallDuration(activeCall.duration)}
            </div>
          )}
        </>
      ) : (
        /* Audio-only call */
        <div style={{ textAlign: 'center', zIndex: 2 }}>
          <div style={{
            width: '120px', height: '120px', borderRadius: '50%',
            background: 'rgba(217,38,73,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', fontSize: '44px', fontWeight: 700, color: 'white',
            animation: activeCall.status === 'connected' ? 'none' : 'mc-call-pulse 1.5s ease-out infinite',
          }}>
            {activeCall.peerId.charAt(0).toUpperCase()}
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'white', marginBottom: '10px' }}>
            Llamada de voz
          </div>
          <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)' }}>
            {activeCall.status === 'calling' && '📞 Llamando...'}
            {activeCall.status === 'ringing' && '🔔 Conectando...'}
            {activeCall.status === 'connected' && `⏱️ ${formatCallDuration(activeCall.duration)}`}
            {activeCall.status === 'ended' && '❌ Llamada finalizada'}
          </div>
        </div>
      )}

      {/* Call Controls */}
      <div style={{
        position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: '20px', zIndex: 3,
        background: 'rgba(0,0,0,0.5)', borderRadius: '40px', padding: '12px 24px',
      }}>
        <button
          onClick={onToggleMute}
          title={activeCall.isMuted ? 'Activar micrófono' : 'Silenciar'}
          style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: activeCall.isMuted ? '#ef4444' : 'rgba(255,255,255,0.15)',
            border: 'none', color: 'white', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {activeCall.isMuted ? <MicOff size={24} /> : <Mic size={24} />}
        </button>

        {isVideo && (
          <button
            onClick={onToggleVideo}
            title={activeCall.isVideoOff ? 'Activar cámara' : 'Apagar cámara'}
            style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: activeCall.isVideoOff ? '#ef4444' : 'rgba(255,255,255,0.15)',
              border: 'none', color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {activeCall.isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
          </button>
        )}

        <button
          onClick={onEndCall}
          title="Colgar"
          style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: '#ef4444', border: 'none', color: 'white', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(239,68,68,0.5)',
          }}
        >
          <PhoneOff size={24} />
        </button>
      </div>

      <style>{`
        @keyframes mc-call-pulse { 0% { box-shadow: 0 0 0 0 rgba(29,78,216,0.5); } 70% { box-shadow: 0 0 0 30px rgba(29,78,216,0); } 100% { box-shadow: 0 0 0 0 rgba(29,78,216,0); } }
      `}</style>
    </div>
  );
};

export default GlobalActiveCallOverlay;