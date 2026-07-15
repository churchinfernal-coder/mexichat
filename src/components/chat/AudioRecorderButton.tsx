import React from 'react';
import { Mic, Square, X } from 'lucide-react';
import { formatAudioDuration } from '@/utils/audioEncoder';

interface AudioRecorderButtonProps {
  isRecording: boolean;
  duration: number;
  isSupported: boolean;
  onStart: () => void | Promise<void>;
  onStop: () => void;
  onCancel: () => void;
}

const AudioRecorderButton: React.FC<AudioRecorderButtonProps> = ({
  isRecording, duration, isSupported, onStart, onStop, onCancel,
}) => {
  if (!isSupported) return null;

  if (isRecording) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 8px', width: '100%', flexWrap: 'wrap' }}>
        <button type="button" onClick={onCancel} title="Cancelar" style={{
          background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer', padding: '6px', display: 'flex',
        }}><X size={18} /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 140px', minWidth: 0 }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', animation: 'blink-rec 1s infinite' }} />
          <span style={{ fontSize: '13px', color: '#ef4444', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {formatAudioDuration(duration)}
          </span>
        </div>
        <button type="button" onClick={onStop} title="Enviar audio" style={{
          width: '36px', height: '36px', borderRadius: '50%', background: 'var(--mc-blue)',
          border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Square size={14} /></button>
        <style>{`@keyframes blink-rec { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      </div>
    );
  }

  return (
    <button type="button" onClick={() => { void onStart(); }} title="Grabar audio" className="mensajes-input-btn" style={{ color: 'var(--mc-text-muted)', touchAction: 'manipulation' }}>
      <Mic size={20} />
    </button>
  );
};

export default AudioRecorderButton;