/**
 * Generate MexiChat ringtone WAV files
 * Run: node scripts/generate-ringtones.js
 */
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const DURATION = 3; // seconds per ringtone cycle

function generateWav(samples) {
  const numSamples = samples.length;
  const byteRate = SAMPLE_RATE * 2;
  const blockAlign = 2;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // 16-bit
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < numSamples; i++) {
    const val = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(val * 32767), 44 + i * 2);
  }
  return buffer;
}

function sine(freq, t) { return Math.sin(2 * Math.PI * freq * t); }
function fade(t, dur, fadeIn = 0.01, fadeOut = 0.05) {
  if (t < fadeIn) return t / fadeIn;
  if (t > dur - fadeOut) return (dur - t) / fadeOut;
  return 1;
}

// ── Clasica: Traditional phone ring (two-tone burst) ──
function clasica() {
  const total = SAMPLE_RATE * DURATION;
  const samples = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const t = i / SAMPLE_RATE;
    const ringOn = (t % 1.5) < 0.8; // ring 0.8s, silence 0.7s
    if (ringOn) {
      const localT = t % 1.5;
      samples[i] = 0.4 * (sine(440, t) + sine(480, t)) * fade(localT, 0.8, 0.005, 0.005);
    }
  }
  return samples;
}

// ── Moderna: Rising chirp melody ──
function moderna() {
  const total = SAMPLE_RATE * DURATION;
  const samples = new Float32Array(total);
  const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
  const noteLen = 0.18;
  const gap = 0.08;
  for (let i = 0; i < total; i++) {
    const t = i / SAMPLE_RATE;
    const cycle = t % 1.5;
    const noteIdx = Math.floor(cycle / (noteLen + gap));
    const noteT = cycle - noteIdx * (noteLen + gap);
    if (noteIdx < notes.length && noteT < noteLen) {
      samples[i] = 0.35 * sine(notes[noteIdx], t) * fade(noteT, noteLen, 0.01, 0.03);
    }
  }
  return samples;
}

// ── Suave: Gentle soft tone (low sine waves) ──
function suave() {
  const total = SAMPLE_RATE * DURATION;
  const samples = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const t = i / SAMPLE_RATE;
    const env = 0.3 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 2 * t)); // slow pulse
    samples[i] = env * (0.6 * sine(330, t) + 0.3 * sine(660, t)) * fade(t, DURATION, 0.1, 0.1);
  }
  return samples;
}

// ── Marimba: Plucky marimba-like hits ──
function marimba() {
  const total = SAMPLE_RATE * DURATION;
  const samples = new Float32Array(total);
  const hits = [
    { time: 0.0, freq: 523 },
    { time: 0.25, freq: 659 },
    { time: 0.5, freq: 784 },
    { time: 0.75, freq: 659 },
    { time: 1.5, freq: 523 },
    { time: 1.75, freq: 659 },
    { time: 2.0, freq: 784 },
    { time: 2.25, freq: 659 },
  ];
  for (let i = 0; i < total; i++) {
    const t = i / SAMPLE_RATE;
    for (const hit of hits) {
      const dt = t - hit.time;
      if (dt >= 0 && dt < 0.3) {
        const env = Math.exp(-dt * 12); // fast decay
        samples[i] += 0.4 * env * (sine(hit.freq, t) + 0.3 * sine(hit.freq * 2, t));
      }
    }
    samples[i] = Math.max(-1, Math.min(1, samples[i]));
  }
  return samples;
}

// ── Digital: Retro digital beeps ──
function digital() {
  const total = SAMPLE_RATE * DURATION;
  const samples = new Float32Array(total);
  const pattern = [
    { start: 0.0, dur: 0.1, freq: 1200 },
    { start: 0.15, dur: 0.1, freq: 1400 },
    { start: 0.3, dur: 0.15, freq: 1000 },
    { start: 0.6, dur: 0.1, freq: 1200 },
    { start: 0.75, dur: 0.1, freq: 1400 },
    { start: 0.9, dur: 0.15, freq: 1000 },
    { start: 1.5, dur: 0.1, freq: 1200 },
    { start: 1.65, dur: 0.1, freq: 1400 },
    { start: 1.8, dur: 0.15, freq: 1000 },
    { start: 2.1, dur: 0.1, freq: 1200 },
    { start: 2.25, dur: 0.1, freq: 1400 },
    { start: 2.4, dur: 0.15, freq: 1000 },
  ];
  for (let i = 0; i < total; i++) {
    const t = i / SAMPLE_RATE;
    for (const p of pattern) {
      const dt = t - p.start;
      if (dt >= 0 && dt < p.dur) {
        // Square wave approximation
        samples[i] += 0.25 * Math.sign(sine(p.freq, t)) * fade(dt, p.dur, 0.005, 0.01);
      }
    }
    samples[i] = Math.max(-1, Math.min(1, samples[i]));
  }
  return samples;
}

// ── Mexicana: Festive mariachi-inspired ──
function mexicana() {
  const total = SAMPLE_RATE * DURATION;
  const samples = new Float32Array(total);
  // Trumpet-like: A4 C5 E5 A5 (A major arpeggio)
  const notes = [
    { time: 0.0, freq: 440, dur: 0.2 },
    { time: 0.25, freq: 523, dur: 0.2 },
    { time: 0.5, freq: 659, dur: 0.2 },
    { time: 0.75, freq: 880, dur: 0.4 },
    { time: 1.5, freq: 440, dur: 0.2 },
    { time: 1.75, freq: 523, dur: 0.2 },
    { time: 2.0, freq: 659, dur: 0.2 },
    { time: 2.25, freq: 880, dur: 0.4 },
  ];
  for (let i = 0; i < total; i++) {
    const t = i / SAMPLE_RATE;
    for (const n of notes) {
      const dt = t - n.time;
      if (dt >= 0 && dt < n.dur) {
        const env = Math.exp(-dt * 4) * fade(dt, n.dur, 0.01, 0.02);
        // Trumpet = sine + harmonics with vibrato
        const vibrato = 1 + 0.003 * Math.sin(2 * Math.PI * 5.5 * t);
        const f = n.freq * vibrato;
        samples[i] += 0.3 * env * (sine(f, t) + 0.5 * sine(f * 2, t) + 0.2 * sine(f * 3, t));
      }
    }
    samples[i] = Math.max(-1, Math.min(1, samples[i]));
  }
  return samples;
}

// Generate all
const outDir = path.join(__dirname, '..', 'public', 'sounds', 'ringtones');
fs.mkdirSync(outDir, { recursive: true });

const ringtones = {
  clasica, moderna, suave, marimba, digital, mexicana
};

for (const [name, fn] of Object.entries(ringtones)) {
  const samples = fn();
  const wav = generateWav(samples);
  const filePath = path.join(outDir, `${name}.wav`);
  fs.writeFileSync(filePath, wav);
  console.log(`Generated: ${filePath} (${(wav.length / 1024).toFixed(1)} KB)`);
}

console.log('\nDone! All ringtones generated in public/sounds/ringtones/');