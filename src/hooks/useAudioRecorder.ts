'use client';

import { useRef, useState, useEffect } from 'react';

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: false,
  autoGainControl: true,
  sampleRate: 48000,
};

const RECORDER_OPTIONS: MediaRecorderOptions = {
  mimeType: 'audio/webm;codecs=opus',
  audioBitsPerSecond: 128000,
};

interface UseAudioRecorderOptions {
  onRecorded: (blob: Blob) => void;
  onError?: (error: Error) => void;
  minSizeBytes?: number;
}

interface UseAudioRecorderReturn {
  isRecording: boolean;
  elapsedSeconds: number;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

export function useAudioRecorder({
  onRecorded,
  onError,
  minSizeBytes = 512,
}: UseAudioRecorderOptions): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (elapsedIntervalRef.current) {
        clearInterval(elapsedIntervalRef.current);
        elapsedIntervalRef.current = null;
      }
    };
  }, []);

  const stopElapsedTimer = () => {
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }
    setElapsedSeconds(0);
  };

  const startRecording = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: AUDIO_CONSTRAINTS,
      });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, RECORDER_OPTIONS);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        stopElapsedTimer();

        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size < minSizeBytes) {
          const sizeError = new Error('No audio detected. Please record your response and try again.');
          if (onError) {
            onError(sizeError);
          } else {
            console.error(sizeError.message);
          }
          setIsRecording(false);
          return;
        }
        onRecorded(blob);
        setIsRecording(false);
      };

      mediaRecorder.start();
      setIsRecording(true);
      const startedAt = Date.now();
      elapsedIntervalRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
      }, 1000);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (onError) {
        onError(error);
      } else {
        console.error('Error accessing microphone:', error);
      }
    }
  };

  const stopRecording = (): void => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  return { isRecording, elapsedSeconds, startRecording, stopRecording };
}
