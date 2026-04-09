/**
 * MEXICHAT — AudioSpeedPlayer
 * Replaces default <audio> for voice messages. 1x, 1.5x, 2x toggle.
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';

interface AudioSpeedPlayerProps {
  src: string;
  style?: React.CSSProperties;
}

const SPEEDS = [1, 1.5, 2];

const AudioSpeedPlayer: React.FC<AudioSpeedPlayerProps> = ({ src, style }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const rafRef = useRef<number>();

  const updateProgress = useCallback(() => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
      if (!audioRef.current.paused) rafRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnded = () => { setPlaying(false); setProgress(0); };
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('ended', onEnded);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); rafRef.current = requestAnimationFrame(updateProgress); }
  };

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * duration;
    setProgress(pct * duration);
  };

  const fmt = (s: number) => {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const pct = duration > 0 ? (progress / duration) * 100 : 0;
  const speed = SPEEDS[speedIdx];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'rgba(0,0,0,0.04)', borderRadius: '20px', maxWidth: '260px', ...style }}>
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause */}
      <button onClick={togglePlay}
        style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#1d4ed8', border: 'none', color: 'white',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {playing ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: '2px' }} />}
      </button>

      {/* Waveform / progress bar */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div onClick={seek} style={{ height: '20px', display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'relative' }}>
          {/* Fake waveform bars */}
          <div style={{ display: 'flex', gap: '1.5px', alignItems: 'center', width: '100%', height: '16px' }}>
            {Array.from({ length: 30 }, (_, i) => {
              const h = 4 + Math.sin(i * 0.7) * 6 + Math.cos(i * 1.3) * 4;
              const filled = (i / 30) * 100 <= pct;
              return <div key={i} style={{ flex: 1, height: `${h}px`, borderRadius: '1px', background: filled ? '#1d4ed8' : 'rgba(0,0,0,0.15)', transition: 'background 0.1s' }} />;
            })}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', marginTop: '1px' }}>
          <span>{fmt(progress)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>

      {/* Speed toggle */}
      <button onClick={cycleSpeed}
        style={{ padding: '2px 6px', borderRadius: '10px', fontSize: '11px', fontWeight: 800,
          background: speed !== 1 ? 'rgba(29,78,216,0.1)' : 'rgba(0,0,0,0.06)',
          color: speed !== 1 ? '#1d4ed8' : '#64748b',
          border: 'none', cursor: 'pointer', flexShrink: 0, minWidth: '32px' }}>
        {speed}x
      </button>
    </div>
  );
};

export default AudioSpeedPlayer;