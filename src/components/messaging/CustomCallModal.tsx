// src/components/messaging/CustomCallModal.tsx
// Current Date and Time (UTC - YYYY-MM-DD HH:MM:SS formatted): 2025-11-15 17:45:46
// Current User's Login: mexivanzamexivanza

import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Maximize2, Minimize2 } from 'lucide-react';
import './CustomCallModal.css';

interface CustomCallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  otherUser: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
  callType: 'audio' | 'video';
  isInitiator: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callStatus: 'calling' | 'ringing' | 'active' | 'ended';
  onEndCall: () => void;
  onToggleMic?: () => void;
  onToggleVideo?: () => void;
  isMicMuted?: boolean;
  isVideoOff?: boolean;
}

/**
 * CustomCallModal - Enterprise-grade video/audio call interface
 * Features:
 * - Picture-in-picture video layout
 * - Real-time call duration timer
 * - Fullscreen mode support
 * - Audio/video controls
 * - Automatic stream attachment
 * - Mobile responsive design
 */
const CustomCallModal: React.FC<CustomCallModalProps> = ({
  open,
  onOpenChange,
  otherUser,
  callType,
  isInitiator,
  localStream,
  remoteStream,
  callStatus,
  onEndCall,
  onToggleMic,
  onToggleVideo,
  isMicMuted = false,
  isVideoOff = false
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const callStartTime = useRef<number | null>(null);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      console.log('[CallModal] 🎥 Attaching local stream with tracks:', {
        audio: localStream.getAudioTracks().length,
        video: localStream.getVideoTracks().length
      });
      
      // Debug audio track state
      localStream.getAudioTracks().forEach((track, i) => {
        console.log(`[CallModal] Local audio track ${i}:`, {
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState
        });
      });
      
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.muted = true; // Always mute local video to prevent echo
      
      // Force play
      localVideoRef.current.play().catch(e => {
        console.warn('[CallModal] ⚠️ Local video autoplay failed:', e);
      });
    }
  }, [localStream]);

  // Attach remote stream to video element with enhanced audio handling
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log('[CallModal] 🎥 Attaching remote stream with tracks:', {
        audio: remoteStream.getAudioTracks().length,
        video: remoteStream.getVideoTracks().length
      });
      
      // Debug each audio track
      remoteStream.getAudioTracks().forEach((track, i) => {
        console.log(`[CallModal] Remote audio track ${i}:`, {
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState
        });
      });
      
      remoteVideoRef.current.srcObject = remoteStream;
      
      // CRITICAL: Ensure audio is NOT muted and volume is up
      remoteVideoRef.current.muted = false;
      remoteVideoRef.current.volume = 1.0;
      
      // Set audio output (if supported)
      if (typeof remoteVideoRef.current.setSinkId === 'function') {
        remoteVideoRef.current.setSinkId('default').catch(e => {
          console.warn('[CallModal] Could not set audio output device:', e);
        });
      }
      
      // Force play with audio
      remoteVideoRef.current.play().then(() => {
        console.log('[CallModal] ✅ Remote video/audio playing');
        
        // Double-check audio is not muted after play
        if (remoteVideoRef.current) {
          remoteVideoRef.current.muted = false;
          remoteVideoRef.current.volume = 1.0;
        }
      }).catch(e => {
        console.warn('[CallModal] ⚠️ Remote video autoplay failed:', e);
        
        // If autoplay fails, try again with user interaction
        const playWithInteraction = () => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.play().then(() => {
              console.log('[CallModal] ✅ Remote video playing after user interaction');
              if (remoteVideoRef.current) {
                remoteVideoRef.current.muted = false;
                remoteVideoRef.current.volume = 1.0;
              }
            });
          }
          document.removeEventListener('click', playWithInteraction);
        };
        document.addEventListener('click', playWithInteraction, { once: true });
      });
    }
  }, [remoteStream]);

  // Monitor remote stream track changes
  useEffect(() => {
    if (!remoteStream) return;

    const handleTrackAdded = (event: any) => {
      console.log('[CallModal] 🎵 New track added to remote stream:', event.track.kind);
      
      // If it's an audio track, ensure it's playing
      if (event.track.kind === 'audio' && remoteVideoRef.current) {
        remoteVideoRef.current.muted = false;
        remoteVideoRef.current.volume = 1.0;
        remoteVideoRef.current.play().catch(e => {
          console.warn('[CallModal] Could not play after track added:', e);
        });
      }
    };

    remoteStream.addEventListener('addtrack', handleTrackAdded);

    return () => {
      remoteStream.removeEventListener('addtrack', handleTrackAdded);
    };
  }, [remoteStream]);

  // Start timer when call becomes active
  useEffect(() => {
    if (callStatus === 'active' && !callStartTime.current) {
      console.log('[CallModal] ⏱️ Call active - starting timer');
      callStartTime.current = Date.now();
      
      durationInterval.current = setInterval(() => {
        if (callStartTime.current) {
          setCallDuration(Math.floor((Date.now() - callStartTime.current) / 1000));
        }
      }, 1000);
    } else if (callStatus === 'ended' || !open) {
      // Clear timer
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }
      callStartTime.current = null;
      setCallDuration(0);
    }

    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, [callStatus, open]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[CallModal] 🧹 Cleaning up modal');
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, []);

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    console.log('[CallModal] Fullscreen toggled:', !isFullscreen);
  };

  const handleEndCall = () => {
    console.log('[CallModal] 📞 End call clicked');
    onEndCall();
  };

  const handleToggleMic = () => {
    console.log('[CallModal] 🎤 Mic toggle clicked');
    onToggleMic?.();
  };

  const handleToggleVideo = () => {
    console.log('[CallModal] 📹 Video toggle clicked');
    onToggleVideo?.();
  };

  if (!open) return null;

  const showVideo = callType === 'video' && !isVideoOff;
  const hasRemoteVideo = remoteStream && remoteStream.getVideoTracks().length > 0;
  const hasLocalVideo = localStream && localStream.getVideoTracks().length > 0;

  return (
    <div className={`custom-call-modal ${isFullscreen ? 'fullscreen' : ''}`}>
      <div className="call-modal-overlay" onClick={() => onOpenChange(false)} />
      
      <div className="call-modal-content">
        <div className="call-modal-header">
          <div className="call-user-info">
            {otherUser.avatar_url ? (
              <img src={otherUser.avatar_url} alt={otherUser.full_name} className="call-avatar" />
            ) : (
              <div className="call-avatar-fallback">
                {otherUser.full_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="call-user-details">
              <h3>{otherUser.full_name}</h3>
              <p className="call-status-text">
                {callStatus === 'calling' && '📞 Llamando...'}
                {callStatus === 'ringing' && '🔔 Sonando...'}
                {callStatus === 'active' && `⏱️ ${formatDuration(callDuration)}`}
                {callStatus === 'ended' && '❌ Llamada finalizada'}
              </p>
            </div>
          </div>
          
          {callType === 'video' && (
            <button className="fullscreen-btn" onClick={toggleFullscreen} title="Pantalla completa">
              {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
          )}
        </div>

        <div className="call-modal-body">
          {showVideo ? (
            <div className="video-container">
              {/* Remote video (main view) */}
              <video
                ref={remoteVideoRef}
                className="remote-video"
                autoPlay
                playsInline
                style={{ 
                  display: hasRemoteVideo ? 'block' : 'none' 
                }}
              />
              
              {/* Show placeholder when no remote video */}
              {!hasRemoteVideo && (
                <div className="video-placeholder">
                  <div className="placeholder-avatar">
                    {otherUser.full_name.charAt(0).toUpperCase()}
                  </div>
                  <p>🎥 Esperando video...</p>
                  {callStatus === 'active' && (
                    <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', opacity: 0.8 }}>
                      📡 Conectado - Audio activo
                    </p>
                  )}
                </div>
              )}
              
              {/* Local video (picture-in-picture) */}
              <div className="pip-container">
                <video
                  ref={localVideoRef}
                  className="local-video"
                  autoPlay
                  muted
                  playsInline
                  style={{ 
                    display: hasLocalVideo ? 'block' : 'none' 
                  }}
                />
                {!hasLocalVideo && (
                  <div style={{ 
                    width: '100%', 
                    height: '100%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    fontSize: '2rem'
                  }}>
                    📷
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="audio-call-container">
              <div className="audio-avatar">
                {otherUser.avatar_url ? (
                  <img src={otherUser.avatar_url} alt={otherUser.full_name} />
                ) : (
                  <div className="audio-avatar-fallback">
                    {otherUser.full_name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              
              {/* Hidden video elements for audio-only calls to establish connection */}
              <video 
                ref={localVideoRef} 
                style={{ display: 'none' }} 
                autoPlay 
                muted 
                playsInline 
              />
              <video 
                ref={remoteVideoRef} 
                style={{ display: 'none' }} 
                autoPlay 
                playsInline 
              />
              
              <div className="audio-status">
                <h2>{otherUser.full_name}</h2>
                <p>
                  {callStatus === 'calling' && '📞 Llamando...'}
                  {callStatus === 'ringing' && '🔔 Sonando...'}
                  {callStatus === 'active' && (
                    <>
                      ⏱️ {formatDuration(callDuration)}
                      <br />
                      <span style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                        🎵 Audio conectado
                      </span>
                    </>
                  )}
                  {callStatus === 'ended' && '❌ Llamada finalizada'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="call-modal-footer">
          <div className="call-controls">
            {onToggleMic && (
              <button
                className={`control-btn ${isMicMuted ? 'muted' : ''}`}
                onClick={handleToggleMic}
                title={isMicMuted ? 'Activar micrófono' : 'Silenciar'}
              >
                {isMicMuted ? <MicOff size={24} /> : <Mic size={24} />}
              </button>
            )}
            
            <button
              className="control-btn end-call"
              onClick={handleEndCall}
              title="Finalizar llamada"
            >
              <PhoneOff size={24} />
            </button>
            
            {callType === 'video' && onToggleVideo && (
              <button
                className={`control-btn ${isVideoOff ? 'muted' : ''}`}
                onClick={handleToggleVideo}
                title={isVideoOff ? 'Activar video' : 'Desactivar video'}
              >
                {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomCallModal;