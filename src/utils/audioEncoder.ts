/**
 * MEXICHAT — Audio Encoder Utilities
 * Handles browser-specific MediaRecorder MIME types
 * Safari doesn't support webm — falls back to mp4
 */

export interface AudioFormat {
  mimeType: string;
  extension: string;
  audioBitsPerSecond: number;
}

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext || null;
}

function canUseMediaRecorder(): boolean {
  return !!(
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  );
}

function canUseWebAudioRecording(): boolean {
  return !!(
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    getAudioContextConstructor()
  );
}

/**
 * Get the best supported audio format for this browser.
 */
export function getSupportedAudioFormat(): AudioFormat {
  if (!canUseMediaRecorder()) {
    return { mimeType: 'audio/wav', extension: 'wav', audioBitsPerSecond: 128000 };
  }

  const formats: AudioFormat[] = [
    { mimeType: 'audio/webm;codecs=opus', extension: 'webm', audioBitsPerSecond: 128000 },
    { mimeType: 'audio/webm', extension: 'webm', audioBitsPerSecond: 128000 },
    { mimeType: 'audio/mp4', extension: 'mp4', audioBitsPerSecond: 128000 },
    { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg', audioBitsPerSecond: 128000 },
    { mimeType: 'audio/mpeg', extension: 'mp3', audioBitsPerSecond: 128000 },
  ];

  for (const format of formats) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(format.mimeType)) {
      return format;
    }
  }

  // Ultimate fallback
  return { mimeType: '', extension: 'webm', audioBitsPerSecond: 128000 };
}

/**
 * Create an audio blob from recorded chunks.
 */
export function createAudioBlob(chunks: Blob[], mimeType: string): Blob {
  return new Blob(chunks, { type: mimeType || 'audio/webm' });
}

/**
 * Create a File from audio blob for upload.
 */
export function createAudioFile(blob: Blob, extension: string): File {
  const filename = `voice_${Date.now()}.${extension}`;
  return new File([blob], filename, {
    type: blob.type,
    lastModified: Date.now(),
  });
}

function interleaveFloat32Chunks(chunks: Float32Array[]): Float32Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

function floatTo16BitPcm(output: DataView, offset: number, input: Float32Array): void {
  for (let i = 0; i < input.length; i++) {
    const sample = Math.max(-1, Math.min(1, input[i] ?? 0));
    output.setInt16(offset + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
}

export function createWavBlob(chunks: Float32Array[], sampleRate: number): Blob {
  const data = interleaveFloat32Chunks(chunks);
  const buffer = new ArrayBuffer(44 + data.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + data.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, data.length * 2, true);
  floatTo16BitPcm(view, 44, data);

  return new Blob([view], { type: 'audio/wav' });
}

/**
 * Format audio duration in mm:ss.
 */
export function formatAudioDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Check if browser supports audio recording.
 */
export function isAudioRecordingSupported(): boolean {
  return !!(
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    (canUseMediaRecorder() || canUseWebAudioRecording())
  );
}