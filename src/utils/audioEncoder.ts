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

/**
 * Get the best supported audio format for this browser.
 */
export function getSupportedAudioFormat(): AudioFormat {
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
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  );
}