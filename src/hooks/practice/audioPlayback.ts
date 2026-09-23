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
export async function playAudioSafely(url: string): Promise<boolean> {
  try {
    await withTimeout(new Audio(url).play(), AUDIO_PLAYBACK_BLOCK_TIMEOUT_MS, 'audio-playback-blocked');
    return true;
  } catch (error) {
    console.warn('[practice audio] playback safeguard:', error instanceof Error ? error.message : error);
    return false;
  }
}
