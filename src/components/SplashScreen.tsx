import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinished: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinished }) => {
  const [phase, setPhase] = useState<'visible' | 'fading' | 'done'>('visible');

  useEffect(() => {
    // Play welcome chime
    playWelcomeChime();

    // Hold splash for 2s, then start 0.8s fade
    const holdTimer = setTimeout(() => setPhase('fading'), 2000);
    return () => clearTimeout(holdTimer);
  }, []);

  useEffect(() => {
    if (phase === 'fading') {
      const fadeTimer = setTimeout(() => {
        setPhase('done');
        onFinished();
      }, 800);
      return () => clearTimeout(fadeTimer);
    }
  }, [phase, onFinished]);

  if (phase === 'done') return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white"
      style={{
        opacity: phase === 'fading' ? 0 : 1,
        transition: 'opacity 0.8s ease-in-out',
      }}
    >
      {/* Chat icon */}
      <div className="mb-6">
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="80" height="80" rx="18" fill="#3B82F6" />
          <path
            d="M24 28C24 25.8 25.8 24 28 24H52C54.2 24 56 25.8 56 28V44C56 46.2 54.2 48 52 48H36L28 54V48C25.8 48 24 46.2 24 44V28Z"
            fill="white"
          />
          <circle cx="34" cy="36" r="2.5" fill="#3B82F6" />
          <circle cx="40" cy="36" r="2.5" fill="#3B82F6" />
          <circle cx="46" cy="36" r="2.5" fill="#3B82F6" />
        </svg>
      </div>

      {/* App name */}
      <h1 className="text-3xl font-bold tracking-tight mb-2">
        <span className="text-gray-900">Mexi</span>
        <span className="text-blue-500">Chat</span>
      </h1>

      {/* Subtitle */}
      <p className="text-sm text-gray-400 tracking-wide">
        Mensajería segura y privada
      </p>
    </div>
  );
};

/**
 * Short pleasant ascending chime for app startup.
 * Plays without requiring prior user interaction (best-effort).
 */
function playWelcomeChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 — major chord arpeggio
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = now + i * 0.15;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  } catch {
    // Audio may be blocked until user interaction — that's fine
  }
}

export default SplashScreen;
