export const AUDIO_LOAD_TIMEOUT_MS = 15000;

export interface AudioClipHandlers {
  onLoading?: () => void;
  onReady?: () => void;
  onPlaying?: () => void;
  onEnded?: () => void;
  onError?: () => void;
}

export interface AudioClip {
  play: () => void;
  stop: () => void;
}

/**
 * @param src - audio url or data uri
 * @param handlers - lifecycle callbacks, each fired at most meaningfully once per transition
 * @param loadTimeoutMs - max wait before playback starts
 * @returns clip controller that never throws
 */
export function createAudioClip(
  src: string,
  handlers: AudioClipHandlers,
  loadTimeoutMs: number = AUDIO_LOAD_TIMEOUT_MS,
): AudioClip {
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const audio = new Audio(src);

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const armTimer = () => {
    if (timer || disposed) return;
    timer = setTimeout(fail, loadTimeoutMs);
  };

  function fail() {
    if (disposed) return;
    clearTimer();
    audio.pause();
    handlers.onError?.();
  }

  audio.onerror = fail;
  audio.onstalled = armTimer;
  audio.oncanplay = () => {
    if (!disposed) handlers.onReady?.();
  };
  audio.onplaying = () => {
    if (disposed) return;
    clearTimer();
    handlers.onPlaying?.();
  };
  audio.onended = () => {
    if (disposed) return;
    clearTimer();
    handlers.onEnded?.();
  };

  return {
    play() {
      if (disposed) return;
      handlers.onLoading?.();
      armTimer();
      const started: Promise<void> | undefined = audio.play();
      if (!started || typeof started.catch !== 'function') {
        fail();
        return;
      }
      started.catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        fail();
      });
    },
    stop() {
      disposed = true;
      clearTimer();
      audio.onerror = null;
      audio.onstalled = null;
      audio.oncanplay = null;
      audio.onplaying = null;
      audio.onended = null;
      audio.pause();
    },
  };
}

export interface ClipPlayback {
  finished: Promise<'ended' | 'error' | 'stopped'>;
  stop: () => void;
}

/**
 * @param src - audio url or data uri
 * @param hooks - onStart just before playback is requested, onError on failure
 * @returns promise resolving when playback ends, fails or is stopped; never rejects
 */
export function playClip(src: string, hooks: { onStart?: () => void; onError?: () => void } = {}): ClipPlayback {
  let settle: (outcome: 'ended' | 'error' | 'stopped') => void = () => {};
  const finished = new Promise<'ended' | 'error' | 'stopped'>((resolve) => {
    settle = resolve;
  });
  const clip = createAudioClip(src, {
    onEnded: () => settle('ended'),
    onError: () => {
      hooks.onError?.();
      settle('error');
    },
  });
  hooks.onStart?.();
  clip.play();
  return {
    finished,
    stop: () => {
      clip.stop();
      settle('stopped');
    },
  };
}
