import { createAudioClip } from '@/lib/audio-clip';

export const AUDIO_GENERATION_TIMEOUT_MS = 15000;
export const AUDIO_PLAYBACK_BLOCK_TIMEOUT_MS = 2500;

/**
 * @template T
 * @param promise Promise<T>
 * @param ms number
 * @param timeoutMessage string
 * @returns Promise<T>
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * @param url string
 * @returns Promise<boolean>
 */
export function playAudioSafely(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const clip = createAudioClip(
      url,
      {
        onPlaying: () => resolve(true),
        onError: () => {
          console.warn('[practice audio] playback safeguard: audio-playback-blocked');
          resolve(false);
        },
      },
      AUDIO_PLAYBACK_BLOCK_TIMEOUT_MS,
    );
    clip.play();
  });
}
