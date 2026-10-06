import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAudioClip, playClip, stopActiveClip } from '@/lib/audio-clip';

class FakeAudio {
  static instances: FakeAudio[] = [];
  static nextPlay: 'resolve' | 'reject' = 'resolve';
  src: string;
  paused = true;
  duration = 10;
  currentTime = 0;
  onerror: (() => void) | null = null;
  onstalled: (() => void) | null = null;
  oncanplay: (() => void) | null = null;
  onplaying: (() => void) | null = null;
  onended: (() => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  onloadedmetadata: (() => void) | null = null;

  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }

  play(): Promise<void> {
    if (FakeAudio.nextPlay === 'reject') return Promise.reject(new Error('NotAllowedError'));
    this.paused = false;
    return Promise.resolve();
  }

  pause(): void {
    this.paused = true;
  }
}

beforeEach(() => {
  FakeAudio.instances = [];
  FakeAudio.nextPlay = 'resolve';
  vi.stubGlobal('Audio', FakeAudio);
  vi.useFakeTimers();
});

afterEach(() => {
  stopActiveClip();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('createAudioClip', () => {
  it('reports an error event', () => {
    const onError = vi.fn();
    createAudioClip('a.mp3', { onError }).play();
    FakeAudio.instances[0].onerror?.();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('reports a rejected play()', async () => {
    FakeAudio.nextPlay = 'reject';
    const onError = vi.fn();
    createAudioClip('a.mp3', { onError }).play();
    await vi.runAllTimersAsync();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('fails after the load timeout when the audio stalls', () => {
    const onError = vi.fn();
    createAudioClip('a.mp3', { onError }, 1000).play();
    vi.advanceTimersByTime(1001);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('keeps a single active clip and notifies the interrupted one', () => {
    const firstStopped = vi.fn();
    createAudioClip('a.mp3', { onStopped: firstStopped }).play();
    createAudioClip('b.mp3', {}).play();
    expect(firstStopped).toHaveBeenCalledTimes(1);
    expect(FakeAudio.instances[0].paused).toBe(true);
  });

  it('stopActiveClip interrupts whatever is playing', () => {
    const onStopped = vi.fn();
    createAudioClip('a.mp3', { onStopped }).play();
    stopActiveClip();
    expect(onStopped).toHaveBeenCalledTimes(1);
  });

  it('reports progress and duration', () => {
    const onProgress = vi.fn();
    const onDuration = vi.fn();
    createAudioClip('a.mp3', { onProgress, onDuration }).play();
    const audio = FakeAudio.instances[0];
    audio.onloadedmetadata?.();
    audio.currentTime = 5;
    audio.ontimeupdate?.();
    audio.onended?.();
    expect(onDuration).toHaveBeenCalledWith(10);
    expect(onProgress).toHaveBeenNthCalledWith(1, 0.5);
    expect(onProgress).toHaveBeenLastCalledWith(1);
  });

  it('ignores events after stop', () => {
    const onEnded = vi.fn();
    const clip = createAudioClip('a.mp3', { onEnded });
    clip.play();
    clip.stop();
    expect(FakeAudio.instances[0].onended).toBeNull();
    expect(onEnded).not.toHaveBeenCalled();
  });
});

describe('playClip', () => {
  it('settles as ended, error or stopped', async () => {
    const ended = playClip('a.mp3');
    FakeAudio.instances[0].onended?.();
    await expect(ended.finished).resolves.toBe('ended');

    const failed = playClip('b.mp3');
    FakeAudio.instances[1].onerror?.();
    await expect(failed.finished).resolves.toBe('error');

    const stopped = playClip('c.mp3');
    stopped.stop();
    await expect(stopped.finished).resolves.toBe('stopped');
  });

  it('pauses and resumes with hooks', () => {
    const onPaused = vi.fn();
    const onResumed = vi.fn();
    const playback = playClip('a.mp3', { onPaused, onResumed });
    playback.pause();
    expect(playback.isPaused()).toBe(true);
    expect(onPaused).toHaveBeenCalledTimes(1);
    playback.resume();
    expect(onResumed).toHaveBeenCalled();
    expect(playback.isPaused()).toBe(false);
  });
});
