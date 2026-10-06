'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createAudioClip, type AudioClip } from '@/lib/audio-clip';

export type AudioClipState = 'idle' | 'loading' | 'ready' | 'playing' | 'error';

export interface UseAudioClipOptions {
  src: string | null;
  maxPlays?: number;
  loadTimeoutMs?: number;
}

export interface UseAudioClip {
  state: AudioClipState;
  playsUsed: number;
  remaining: number | null;
  canPlay: boolean;
  play: () => void;
  retry: () => void;
  stop: () => void;
}

/** @param options UseAudioClipOptions */
export function useAudioClip({ src, maxPlays, loadTimeoutMs }: UseAudioClipOptions): UseAudioClip {
  const [rawState, setState] = useState<AudioClipState>('idle');
  const state: AudioClipState = src ? rawState : 'error';
  const [playsUsed, setPlaysUsed] = useState(0);
  const clipRef = useRef<AudioClip | null>(null);

  const dispose = useCallback(() => {
    clipRef.current?.stop();
    clipRef.current = null;
  }, []);

  const [trackedSrc, setTrackedSrc] = useState(src);
  if (trackedSrc !== src) {
    setTrackedSrc(src);
    setState('idle');
    setPlaysUsed(0);
  }

  useEffect(() => dispose, [src, dispose]);

  const exhausted = maxPlays !== undefined && playsUsed >= maxPlays;

  const start = useCallback(() => {
    if (!src) return;
    dispose();
    let counted = false;
    const clip = createAudioClip(
      src,
      {
        onLoading: () => setState('loading'),
        onReady: () => setState((current) => (current === 'loading' ? 'ready' : current)),
        onPlaying: () => {
          setState('playing');
          if (counted) return;
          counted = true;
          setPlaysUsed((used) => used + 1);
        },
        onEnded: () => setState('ready'),
        onError: () => setState('error'),
      },
      loadTimeoutMs,
    );
    clipRef.current = clip;
    clip.play();
  }, [src, loadTimeoutMs, dispose]);

  const play = useCallback(() => {
    if (exhausted) return;
    start();
  }, [exhausted, start]);

  const stop = useCallback(() => {
    dispose();
    setState('idle');
  }, [dispose]);

  return {
    state,
    playsUsed,
    remaining: maxPlays === undefined ? null : Math.max(0, maxPlays - playsUsed),
    canPlay: Boolean(src) && !exhausted,
    play,
    retry: start,
    stop,
  };
}
