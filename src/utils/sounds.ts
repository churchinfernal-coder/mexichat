/**
 * MEXICHAT - Sound System v7 (Selectable Ringtones)
 * Uses pre-generated WAV files for branded audio.
 * Ringtone loops via 'ended' event for bulletproof cross-browser looping.
 */

// ═══ RINGTONE CATALOG ═══

export interface RingtoneOption {
  id: string;
  name: string;
  file: string;  // path under /sounds/ringtones/
  emoji: string;
}

export const RINGTONE_OPTIONS: RingtoneOption[] = [
  { id: 'default',  name: 'MexiChat',  file: '/sounds/incoming.wav',            emoji: '📱' },
  { id: 'clasica',  name: 'Clasica',   file: '/sounds/ringtones/clasica.wav',   emoji: '📞' },
  { id: 'moderna',  name: 'Moderna',   file: '/sounds/ringtones/moderna.wav',   emoji: '✨' },
  { id: 'suave',    name: 'Suave',     file: '/sounds/ringtones/suave.wav',     emoji: '🌊' },
  { id: 'marimba',  name: 'Marimba',   file: '/sounds/ringtones/marimba.wav',   emoji: '🪘' },
  { id: 'digital',  name: 'Digital',   file: '/sounds/ringtones/digital.wav',   emoji: '🤖' },
  { id: 'mexicana', name: 'Mexicana',  file: '/sounds/ringtones/mexicana.wav',  emoji: '🇲🇽' },
];

const RINGTONE_STORAGE_KEY = 'mexichat_ringtone';

export function getSelectedRingtone(): RingtoneOption {
  try {
    const id = localStorage.getItem(RINGTONE_STORAGE_KEY) || 'default';
    return RINGTONE_OPTIONS.find(r => r.id === id) || RINGTONE_OPTIONS[0];
  } catch {
    return RINGTONE_OPTIONS[0];
  }
}

export function setSelectedRingtone(id: string): void {
  try { localStorage.setItem(RINGTONE_STORAGE_KEY, id); } catch {}
}

// ═══ AUDIO UNLOCK (iOS) ═══

let audioUnlocked = false;

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    if (ctx.state === "suspended") ctx.resume();
  } catch {}
  try {
    const a = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
    a.volume = 0.01;
    a.play().then(() => a.pause()).catch(() => {});
  } catch {}
}

["click", "touchstart", "keydown"].forEach(evt =>
  document.addEventListener(evt, unlockAudio, { once: false, passive: true })
);

// ═══ PRELOAD ═══

const soundCache: Record<string, HTMLAudioElement> = {};

function getSound(name: string): HTMLAudioElement {
  if (!soundCache[name]) {
    soundCache[name] = new Audio("/sounds/" + name + ".wav");
    soundCache[name].preload = "auto";
  }
  return soundCache[name];
}

["message", "incoming", "outgoing", "connect", "end"].forEach(name => {
  try { getSound(name); } catch {}
});

// ═══ ONE-SHOT ═══

function playOneShot(name: string, volume = 0.8) {
  try {
    const audio = new Audio("/sounds/" + name + ".wav");
    audio.volume = volume;
    audio.play().catch(() => {});
  } catch {}
}

export function playNotificationSound(type: "message" | "call" = "message") {
  try {
    if (type === "call") playOneShot("incoming");
    else playOneShot("message");
  } catch {}
}

export function playCallConnect() { playOneShot("connect", 0.7); }
export function playCallEnd() { playOneShot("end", 0.7); }

// ═══ PREVIEW (play once, no loop) ═══

let previewAudio: HTMLAudioElement | null = null;

export function previewRingtone(ringtoneId: string): void {
  stopPreview();
  const option = RINGTONE_OPTIONS.find(r => r.id === ringtoneId) || RINGTONE_OPTIONS[0];
  try {
    previewAudio = new Audio(option.file);
    previewAudio.volume = 0.7;
    previewAudio.play().catch(() => {});
  } catch {}
}

export function stopPreview(): void {
  if (previewAudio) {
    try { previewAudio.pause(); previewAudio.currentTime = 0; } catch {}
    previewAudio = null;
  }
}

// ═══ CONTINUOUS RINGTONE (looped via 'ended' event) ═══

let ringtoneAudio: HTMLAudioElement | null = null;
let ringtoneActive = false;
let ringtoneRestartHandler: (() => void) | null = null;

export function startRingtone(type: "incoming" | "outgoing" = "incoming") {
  stopRingtone();
  ringtoneActive = true;

  // For incoming calls, use the user's selected ringtone
  // For outgoing calls, always use the standard ringback tone
  let filePath: string;
  let volume: number;

  if (type === "incoming") {
    const selected = getSelectedRingtone();
    filePath = selected.file;
    volume = 0.85;
    console.log("[sounds] Starting incoming ringtone: " + selected.name);
  } else {
    filePath = "/sounds/outgoing.wav";
    volume = 0.6;
    console.log("[sounds] Starting outgoing ringback");
  }

  try {
    const audio = new Audio(filePath);
    audio.volume = volume;
    audio.loop = false;
    audio.currentTime = 0;

    ringtoneRestartHandler = () => {
      if (ringtoneActive && ringtoneAudio === audio) {
        try {
          audio.currentTime = 0;
          const p = audio.play();
          if (p) p.catch(() => {});
        } catch {}
      }
    };
    audio.addEventListener("ended", ringtoneRestartHandler);

    const p = audio.play();
    if (p) p.then(() => {
      console.log("[sounds] Ringtone playing");
    }).catch(err => {
      console.warn("[sounds] Ringtone blocked:", err.message);
    });

    ringtoneAudio = audio;
  } catch (err) {
    console.warn("[sounds] Ringtone error:", err);
  }
}

export function stopRingtone() {
  ringtoneActive = false;
  if (ringtoneAudio) {
    try {
      if (ringtoneRestartHandler) {
        ringtoneAudio.removeEventListener("ended", ringtoneRestartHandler);
        ringtoneRestartHandler = null;
      }
      ringtoneAudio.pause();
      ringtoneAudio.currentTime = 0;
    } catch {}
    ringtoneAudio = null;
  }
}