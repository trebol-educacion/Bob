'use client';

import { useCallback, useEffect, useRef } from 'react';
import { generateSpeechAction } from '@/actions/gemini';
import { pcmToWavBase64 } from '@/lib/audio';

export interface TTSPlaybackHooks {
  /** Fires once audio is built and about to play, before `audio.play()`. */
  onStart?: () => void;
  /** Fires when playback fails (load/decode/play error). */
  onError?: () => void;
}

export interface UseTTS {
  /** Generates TTS for text and waits until playback ends or fails. Never rejects. */
  play: (text: string, hooks?: TTSPlaybackHooks) => Promise<void>;
  /** Plays a pre-built audio URL and waits until playback ends or fails. Never rejects. */
  playUrl: (url: string, hooks?: TTSPlaybackHooks) => Promise<void>;
  /**
   * Generates TTS for text, starts playback and resolves immediately without
   * waiting for audio to finish. Audio plays in the background. Never rejects.
   */
  start: (text: string) => Promise<void>;
  stop: () => void;
}

/** React hook that owns one HTMLAudioElement ref and its cleanup; never throws. */
export function useTTS(): UseTTS {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  const playUrl = useCallback(
    async (url: string, hooks?: TTSPlaybackHooks): Promise<void> => {
      stop();
      try {
        const audio = new Audio(url);
        audioRef.current = audio;
        hooks?.onStart?.();
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => {
            hooks?.onError?.();
            resolve();
          };
          audio.play().catch(() => {
            hooks?.onError?.();
            resolve();
          });
        });
        audioRef.current = null;
      } catch {
        /* Audio failure is non-fatal: the flow continues (regla 4) */
      }
    },
    [stop],
  );

  const play = useCallback(
    async (text: string, hooks?: TTSPlaybackHooks): Promise<void> => {
      try {
        const { data, mimeType } = await generateSpeechAction(text);
        const url = pcmToWavBase64(data, mimeType);
        await playUrl(url, hooks);
      } catch {
        hooks?.onError?.();
      }
    },
    [playUrl],
  );

  const start = useCallback(
    async (text: string): Promise<void> => {
      stop();
      try {
        const { data, mimeType } = await generateSpeechAction(text);
        const url = pcmToWavBase64(data, mimeType);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          if (audioRef.current === audio) audioRef.current = null;
        };
        audio.onerror = () => {
          if (audioRef.current === audio) audioRef.current = null;
        };
        audio.play().catch(() => {
          if (audioRef.current === audio) audioRef.current = null;
        });
      } catch {
        /* TTS failure is non-fatal: the flow continues (regla 4) */
      }
    },
    [stop],
  );

  useEffect(() => stop, [stop]);

  return { play, playUrl, start, stop };
}
