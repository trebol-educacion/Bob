'use client';

import { useCallback, useEffect, useRef } from 'react';
import { generateSpeechAction } from '@/actions/gemini';
import { pcmToWavBase64 } from '@/lib/audio';
import { playClip, type ClipPlayback } from '@/lib/audio-clip';

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
  const playbackRef = useRef<ClipPlayback | null>(null);

  const stop = useCallback(() => {
    playbackRef.current?.stop();
    playbackRef.current = null;
  }, []);

  const playUrl = useCallback(
    async (url: string, hooks?: TTSPlaybackHooks): Promise<void> => {
      stop();
      const playback = playClip(url, hooks);
      playbackRef.current = playback;
      await playback.finished;
      if (playbackRef.current === playback) playbackRef.current = null;
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
        const playback = playClip(url);
        playbackRef.current = playback;
        void playback.finished.then(() => {
          if (playbackRef.current === playback) playbackRef.current = null;
        });
      } catch {
        playbackRef.current = null;
      }
    },
    [stop],
  );

  useEffect(() => stop, [stop]);

  return { play, playUrl, start, stop };
}
