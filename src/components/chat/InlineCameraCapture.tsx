/**
 * MexiChat — Inline Camera Capture v1.0
 * Opens real device camera via getUserMedia on ALL platforms (desktop + mobile).
 * Supports: live photo snapshot, video recording, front/back camera switch.
 * Returns File objects ready for the existing uploadFile() pipeline.
 *
 * Copyright (c) 2024-2026 MexiVanza. All Rights Reserved.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Camera, Video, SwitchCamera, Square,
  Circle, FlipHorizontal, Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSupportedAudioFormat } from '@/utils/audioEncoder';

type CaptureMode = 'photo' | 'video';

interface InlineCameraCaptureProps {
  open: boolean;
  onCapture: (file: File, type: 'image' | 'video') => void;
  onClose: () => void;
}

const MAX_VIDEO_DURATION_SEC = 120; // 2 minutes

const InlineCameraCapture: React.FC<InlineCameraCaptureProps> = ({ open, onCapture, onClose }) => {
  const [mode, setMode] = useState<CaptureMode>('photo');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // ── Check for multiple cameras ──
  useEffect(() => {
    if (!open) return;
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      if (mountedRef.current) setHasMultipleCameras(videoInputs.length > 1);
    }).catch(() => {});
  }, [open]);

  // ── Start/restart camera stream ──
  const startStream = useCallback(async () => {
    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setStreamReady(false);
    setError(null);

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
        },
        audio: mode === 'video', // only need audio for video recording
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreamReady(true);
    } catch (err: any) {
      console.error('[InlineCamera] getUserMedia error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Permiso de cámara denegado. Habilita el acceso en la configuración del navegador.');
      } else if (err.name === 'NotFoundError') {
        setError('No se encontró cámara en este dispositivo.');
      } else if (err.name === 'NotReadableError') {
        setError('La cámara está en uso por otra aplicación.');
      } else {
        setError('Error al acceder a la cámara: ' + (err.message || err.name));
      }
    }
  }, [facingMode, mode]);

  useEffect(() => {
    mountedRef.current = true;
    if (open) startStream();
    return () => {
      mountedRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        try { recorderRef.current.stop(); } catch {}
      }
    };
  }, [open, startStream]);

  // ── Restart stream when facing mode or mode changes ──
  useEffect(() => {
    if (open && !isRecording) startStream();
  }, [facingMode, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Take Photo (canvas snapshot) ──
  const takePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamReady) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror if front camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) { toast.error('Error al capturar foto'); return; }
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
      onCapture(file, 'image');
      onClose();
    }, 'image/jpeg', 0.92);
  }, [streamReady, facingMode, onCapture, onClose]);

  // ── Start Video Recording ──
  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];

    const audioFormat = getSupportedAudioFormat();
    // Prefer video/webm with codecs, fallback gracefully
    const videoMimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ];
    let mimeType = '';
    for (const mt of videoMimeTypes) {
      if (MediaRecorder.isTypeSupported(mt)) { mimeType = mt; break; }
    }

    try {
      const recorder = new MediaRecorder(streamRef.current, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        const type = mimeType || 'video/webm';
        const ext = type.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(chunksRef.current, { type });
        const file = new File([blob], `video_${Date.now()}.${ext}`, { type, lastModified: Date.now() });
        if (mountedRef.current) {
          setIsRecording(false);
          setRecordingDuration(0);
          onCapture(file, 'video');
          onClose();
        }
      };

      recorder.start(100);
      recorderRef.current = recorder;
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          const next = prev + 1;
          if (next >= MAX_VIDEO_DURATION_SEC) {
            recorderRef.current?.stop();
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      console.error('[InlineCamera] MediaRecorder error:', err);
      toast.error('Error al iniciar grabación de video');
    }
  }, [onCapture, onClose]);

  // ── Stop Video Recording ──
  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
  }, []);

  // ── Switch Camera ──
  const switchCamera = useCallback(() => {
    if (isRecording) return;
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, [isRecording]);

  // ── Format duration ──
  const fmtDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, background: '#000',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Close button */}
      <button onClick={() => { if (isRecording) stopRecording(); onClose(); }} style={{
        position: 'absolute', top: '16px', right: '16px', zIndex: 210,
        width: '44px', height: '44px', borderRadius: '50%',
        background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <X size={22} />
      </button>

      {/* Error state */}
      {error && (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: 'white', maxWidth: '400px' }}>
          <Camera size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
          <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Cámara no disponible</div>
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{error}</div>
          <button onClick={onClose} style={{
            marginTop: '24px', padding: '12px 32px', background: 'rgba(255,255,255,0.15)',
            border: 'none', borderRadius: '12px', color: 'white', fontWeight: 600,
            fontSize: '14px', cursor: 'pointer',
          }}>Cerrar</button>
        </div>
      )}

      {/* Live camera preview */}
      {!error && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
          }}
        />
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div style={{
          position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: '8px', zIndex: 210,
          background: 'rgba(0,0,0,0.6)', padding: '8px 16px', borderRadius: '20px',
        }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', animation: 'blink-rec 1s infinite' }} />
          <span style={{ color: 'white', fontSize: '14px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {fmtDuration(recordingDuration)}
          </span>
        </div>
      )}

      {/* Bottom controls */}
      {!error && streamReady && (
        <div style={{
          position: 'absolute', bottom: '0', left: '0', right: '0',
          padding: '24px 20px 40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '32px',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
        }}>
          {/* Mode toggle: Photo / Video */}
          {!isRecording && (
            <div style={{
              position: 'absolute', top: '-48px', left: '50%', transform: 'translateX(-50%)',
              display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.5)', borderRadius: '20px', padding: '4px',
            }}>
              <button onClick={() => setMode('photo')} style={{
                padding: '6px 16px', borderRadius: '16px', border: 'none', cursor: 'pointer',
                background: mode === 'photo' ? 'white' : 'transparent',
                color: mode === 'photo' ? '#000' : 'rgba(255,255,255,0.7)',
                fontSize: '12px', fontWeight: 700, transition: 'all 0.2s',
              }}>FOTO</button>
              <button onClick={() => setMode('video')} style={{
                padding: '6px 16px', borderRadius: '16px', border: 'none', cursor: 'pointer',
                background: mode === 'video' ? 'white' : 'transparent',
                color: mode === 'video' ? '#000' : 'rgba(255,255,255,0.7)',
                fontSize: '12px', fontWeight: 700, transition: 'all 0.2s',
              }}>VIDEO</button>
            </div>
          )}

          {/* Switch camera */}
          {hasMultipleCameras && !isRecording && (
            <button onClick={switchCamera} style={{
              width: '48px', height: '48px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <SwitchCamera size={22} />
            </button>
          )}

          {/* Main capture button */}
          {mode === 'photo' ? (
            <button onClick={takePhoto} style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: 'white', border: '4px solid rgba(255,255,255,0.3)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'transform 0.15s',
            }}>
              <Circle size={28} style={{ color: '#333' }} />
            </button>
          ) : isRecording ? (
            <button onClick={stopRecording} style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: 'rgba(239,68,68,0.9)', border: '4px solid rgba(255,255,255,0.3)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Square size={24} style={{ color: 'white' }} />
            </button>
          ) : (
            <button onClick={startRecording} style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: '#ef4444', border: '4px solid rgba(255,255,255,0.3)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Circle size={28} style={{ color: 'white', fill: 'white' }} />
            </button>
          )}

          {/* Spacer for symmetry when no switch camera */}
          {(!hasMultipleCameras || isRecording) && <div style={{ width: '48px' }} />}
        </div>
      )}

      <style>{`@keyframes blink-rec { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
};

export default InlineCameraCapture;