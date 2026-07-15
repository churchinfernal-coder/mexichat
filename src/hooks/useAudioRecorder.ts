import { useState, useRef, useCallback, useEffect } from 'react';
import {
  getSupportedAudioFormat,
  createAudioBlob,
  createAudioFile,
  createWavBlob,
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
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const recordingModeRef = useRef<'media-recorder' | 'web-audio' | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const stoppingRef = useRef(false);
  const formatRef = useRef(getSupportedAudioFormat());
  const supported = isAudioRecordingSupported();

  const cleanup = useCallback(() => {
    recordingModeRef.current = null;
    stoppingRef.current = false;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (processorRef.current) {
      try { processorRef.current.disconnect(); } catch { void 0; }
      processorRef.current = null;
    }

    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch { void 0; }
      sourceNodeRef.current = null;
    }

    if (gainNodeRef.current) {
      try { gainNodeRef.current.disconnect(); } catch { void 0; }
      gainNodeRef.current = null;
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { void 0; }
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    pcmChunksRef.current = [];
    setDuration(0);
    setIsRecording(false);
  }, []);

  const stopRecording = useCallback(async (): Promise<{ file: File; duration: number } | null> => {
    if (!isRecording || stoppingRef.current) return null;
    stoppingRef.current = true;

    const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

    if (recordingModeRef.current === 'web-audio') {
      const chunks = pcmChunksRef.current.slice();
      const sampleRate = audioContextRef.current?.sampleRate || 44100;
      const blob = createWavBlob(chunks, sampleRate);
      const file = createAudioFile(blob, 'wav');
      cleanup();
      return { file, duration: finalDuration };
    }

    if (!mediaRecorderRef.current) {
      cleanup();
      return null;
    }

    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current!;

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (!supported || isRecording) return false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const format = formatRef.current;

      if (typeof MediaRecorder !== 'undefined') {
        const options: MediaRecorderOptions = {};
        if (format.mimeType) options.mimeType = format.mimeType;
        if (format.audioBitsPerSecond) options.audioBitsPerSecond = format.audioBitsPerSecond;

        const recorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = recorder;
        recordingModeRef.current = 'media-recorder';
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.start(100); // Collect data every 100ms
      } else {
        const AudioContextCtor = typeof window !== 'undefined'
          ? (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
          : null;

        if (!AudioContextCtor) {
          cleanup();
          return false;
        }

        const audioContext = new AudioContextCtor();
        audioContextRef.current = audioContext;
        recordingModeRef.current = 'web-audio';
        pcmChunksRef.current = [];

        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0;

        processor.onaudioprocess = (event) => {
          const input = event.inputBuffer.getChannelData(0);
          pcmChunksRef.current.push(new Float32Array(input));
        };

        source.connect(processor);
        processor.connect(gainNode);
        gainNode.connect(audioContext.destination);

        sourceNodeRef.current = source;
        processorRef.current = processor;
        gainNodeRef.current = gainNode;
      }

      startTimeRef.current = Date.now();
      setIsRecording(true);
      setDuration(0);

      // Duration timer
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);
        if (elapsed >= MAX_DURATION_SEC) {
          if (!stoppingRef.current) {
            void stopRecording();
          }
        }
      }, 1000);

      return true;
    } catch {
      cleanup();
      return false;
    }
  }, [supported, isRecording, cleanup, stopRecording]);

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