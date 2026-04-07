// generate-ringtones.mjs — Run with: node generate-ringtones.mjs
// Creates 6 unique MexiChat ringtones as proper WAV files

import { writeFileSync, mkdirSync } from 'fs';

function generateWav(samples, sampleRate = 44100) {
  const numSamples = samples.length;
  const byteRate = sampleRate * 2;
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s * 32767, true);
  }
  return Buffer.from(buffer);
}

function sine(freq, t) { return Math.sin(2 * Math.PI * freq * t); }
function env(t, attack, hold, release, total) {
  if (t < attack) return t / attack;
  if (t < attack + hold) return 1;
  const r = t - attack - hold;
  if (r < release) return 1 - r / release;
  return 0;
}

const SR = 44100;
const DUR = 3.0; // 3 seconds per ringtone cycle (will loop)

// ── Clasica: Classic phone ring (two-tone alternating) ──
function clasica() {
  const samples = [];
  for (let i = 0; i < SR * DUR; i++) {
    const t = i / SR;
    const ringOn = (t % 1.0) < 0.6; // ring 0.6s, silence 0.4s
    if (ringOn) {
      const mod = sine(20, t); // tremolo
      samples.push(0.7 * (sine(440, t) * 0.5 + sine(480, t) * 0.5) * (0.7 + 0.3 * mod));
    } else {
      samples.push(0);
    }
  }
  return samples;
}

// ── Marimba: Mexican marimba-style melodic pattern ──
function marimba() {
  const notes = [523, 659, 784, 880, 784, 659, 523, 659]; // C5 E5 G5 A5 G5 E5 C5 E5
  const noteLen = DUR / notes.length;
  const samples = [];
  for (let i = 0; i < SR * DUR; i++) {
    const t = i / SR;
    const noteIdx = Math.min(Math.floor(t / noteLen), notes.length - 1);
    const nt = t - noteIdx * noteLen;
    const freq = notes[noteIdx];
    const e = env(nt, 0.005, 0.05, noteLen - 0.06, noteLen);
    // Marimba = fundamental + octave + soft decay
    const s = (sine(freq, t) * 0.6 + sine(freq * 2, t) * 0.25 + sine(freq * 4, t) * 0.1) * e * 0.8;
    samples.push(s);
  }
  return samples;
}

// ── Digital: Modern digital chime (ascending) ──
function digital() {
  const notes = [880, 1047, 1175, 1319]; // A5 C6 D6 E6
  const samples = [];
  for (let i = 0; i < SR * DUR; i++) {
    const t = i / SR;
    const cycle = t % 1.5;
    const noteIdx = Math.min(Math.floor(cycle / 0.3), notes.length - 1);
    const nt = cycle - noteIdx * 0.3;
    const freq = notes[noteIdx];
    const e = env(nt, 0.01, 0.05, 0.25, 0.3);
    const s = (sine(freq, t) * 0.5 + sine(freq * 1.5, t) * 0.2) * e * 0.75;
    samples.push(s);
  }
  return samples;
}

// ── Suave: Soft gentle harp-like ──
function suave() {
  const notes = [392, 440, 494, 523, 494, 440]; // G4 A4 B4 C5 B4 A4
  const noteLen = DUR / notes.length;
  const samples = [];
  for (let i = 0; i < SR * DUR; i++) {
    const t = i / SR;
    const noteIdx = Math.min(Math.floor(t / noteLen), notes.length - 1);
    const nt = t - noteIdx * noteLen;
    const freq = notes[noteIdx];
    const e = env(nt, 0.02, 0.1, noteLen - 0.15, noteLen);
    const s = sine(freq, t) * 0.5 * e + sine(freq * 2, t) * 0.15 * e;
    samples.push(s * 0.7);
  }
  return samples;
}

// ── Urgente: Fast pulsing alarm-style ──
function urgente() {
  const samples = [];
  for (let i = 0; i < SR * DUR; i++) {
    const t = i / SR;
    const pulse = (t % 0.3) < 0.2 ? 1 : 0; // fast on/off
    const freq = 800 + 200 * sine(2, t); // slight frequency sweep
    samples.push(sine(freq, t) * 0.8 * pulse);
  }
  return samples;
}

// ── Melodia: Pleasant melody (do-mi-sol-do pattern) ──
function melodia() {
  const notes = [523, 587, 659, 784, 880, 784, 659, 587]; // C5 D5 E5 G5 A5 G5 E5 D5
  const noteLen = DUR / notes.length;
  const samples = [];
  for (let i = 0; i < SR * DUR; i++) {
    const t = i / SR;
    const noteIdx = Math.min(Math.floor(t / noteLen), notes.length - 1);
    const nt = t - noteIdx * noteLen;
    const freq = notes[noteIdx];
    const e = env(nt, 0.01, 0.15, noteLen - 0.2, noteLen);
    const s = (sine(freq, t) * 0.55 + sine(freq * 2, t) * 0.2 + sine(freq * 3, t) * 0.08) * e;
    samples.push(s * 0.75);
  }
  return samples;
}

const ringtones = {
  'ringtone-clasica': clasica,
  'ringtone-marimba': marimba,
  'ringtone-digital': digital,
  'ringtone-suave': suave,
  'ringtone-urgente': urgente,
  'ringtone-melodia': melodia,
};

mkdirSync('public/sounds', { recursive: true });

for (const [name, fn] of Object.entries(ringtones)) {
  const samples = fn();
  const wav = generateWav(samples);
  writeFileSync(`public/sounds/${name}.wav`, wav);
  console.log(`✅ ${name}.wav (${(wav.length / 1024).toFixed(1)} KB)`);
}

console.log('\nAll ringtones generated!');