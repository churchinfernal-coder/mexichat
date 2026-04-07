/**
 * MEXICHAT - Sound System v6 (Reliable Looping Ringtone)
 * Uses pre-generated WAV files for branded audio.
 * Ringtone loops via interval-based replay for bulletproof looping.
 */

// Audio unlock for iOS
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
  console.log("[sounds] Audio unlocked");
}

["click", "touchstart", "keydown"].forEach(evt =>
  document.addEventListener(evt, unlockAudio, { once: false, passive: true })
);

// Preload sounds
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

// One-shot sound player
function playOneShot(name: string, volume = 0.8) {
  try {
    const audio = new Audio("/sounds/" + name + ".wav");
    audio.volume = volume;
    audio.play().catch(() => {
      console.warn("[sounds] Playback blocked for", name);
    });
  } catch {}
}

// Message notification sound
export function playNotificationSound(type: "message" | "call" = "message") {
  try {
    if (type === "call") playOneShot("incoming");
    else playOneShot("message");
  } catch (err) {
    console.warn("[sounds] playNotificationSound failed:", err);
  }
}

// Call connect/end sounds
export function playCallConnect() { playOneShot("connect", 0.7); }
export function playCallEnd() { playOneShot("end", 0.7); }

// ═══════════════════════════════════════════════════════════════
// CONTINUOUS RINGTONE — interval-based replay (bulletproof loop)
// ═══════════════════════════════════════════════════════════════
//
// Why not just audio.loop = true?
// Because many mobile browsers (especially iOS Safari, Samsung Internet,
// and in-app webviews) silently stop looping after 1-2 plays. The 'ended'
// event + manual restart is the only reliable cross-browser approach.

let ringtoneAudio: HTMLAudioElement | null = null;
let ringtoneActive = false;
let ringtoneRestartHandler: (() => void) | null = null;

export function startRingtone(type: "incoming" | "outgoing" = "incoming") {
  stopRingtone();
  ringtoneActive = true;
  console.log("[sounds] Starting " + type + " ringtone (loop mode)");

  try {
    const audio = new Audio("/sounds/" + type + ".wav");
    audio.volume = type === "incoming" ? 0.85 : 0.6;
    audio.loop = false; // We handle looping manually via 'ended' event
    audio.currentTime = 0;

    // When the audio finishes, restart it if ringtone is still active
    ringtoneRestartHandler = () => {
      if (ringtoneActive && ringtoneAudio === audio) {
        try {
          audio.currentTime = 0;
          const p = audio.play();
          if (p) p.catch(() => {
            console.warn("[sounds] Ringtone re-loop blocked");
          });
        } catch {}
      }
    };
    audio.addEventListener("ended", ringtoneRestartHandler);

    const p = audio.play();
    if (p) p.then(() => {
      console.log("[sounds] " + type + " ringtone playing");
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
      // Remove the restart handler first
      if (ringtoneRestartHandler) {
        ringtoneAudio.removeEventListener("ended", ringtoneRestartHandler);
        ringtoneRestartHandler = null;
      }
      ringtoneAudio.pause();
      ringtoneAudio.currentTime = 0;
    } catch {}
    ringtoneAudio = null;
  }
  console.log("[sounds] Ringtone stopped");
}