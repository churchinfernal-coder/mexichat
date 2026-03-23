import { useState, useRef, useCallback, useEffect } from 'react';
import {
  getSupportedAudioFormat,
  createAudioBlob,
  createAudioFile,
  isAudioRecordingSupported,
} from '@/utils/audioEncoder';

const MAX_DURATION_SEC = 300; // 5 minutes

interface AudioRecorderHook {
  isRecording: boolean;
  duration: number;
  isSupported: boolean;
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<{ file: File; duration: number } | null>;
  cancelRecording: () => void;
}

export function useAudioRecorder(): AudioRecorderHook {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const formatRef = useRef(getSupportedAudioFormat());
  const supported = isAudioRecordingSupported();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setDuration(0);
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (!supported || isRecording) return false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const format = formatRef.current;
      const options: MediaRecorderOptions = {};
      if (format.mimeType) options.mimeType = format.mimeType;
      if (format.audioBitsPerSecond) options.audioBitsPerSecond = format.audioBitsPerSecond;

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(100); // Collect data every 100ms
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setDuration(0);

      // Duration timer
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);
        if (elapsed >= MAX_DURATION_SEC) {
          // Auto-stop at max duration
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        }
      }, 1000);

      return true;
    } catch {
      cleanup();
      return false;
    }
  }, [supported, isRecording, cleanup]);

  const stopRecording = useCallback(async (): Promise<{ file: File; duration: number } | null> => {
    if (!mediaRecorderRef.current || !isRecording) return null;

    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current!;
      const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

      recorder.onstop = () => {
        const format = formatRef.current;
        const blob = createAudioBlob(chunksRef.current, format.mimeType);
        const file = createAudioFile(blob, format.extension);
        cleanup();
        resolve({ file, duration: finalDuration });
      };

      if (recorder.state === 'recording') {
        recorder.stop();
      } else {
        cleanup();
        resolve(null);
      }
    });
  }, [isRecording, cleanup]);

  const cancelRecording = useCallback(() => {
    cleanup();
  }, [cleanup]);

  return {
    isRecording,
    duration,
    isSupported: supported,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}