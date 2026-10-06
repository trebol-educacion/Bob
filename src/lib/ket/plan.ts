export const EMPTY_AUDIO = { audio_b64: '', audio_mime: 'audio/L16;codec=pcm;rate=24000' } as const;

const AUDIO_KEYS = new Set(['audio_b64', 'audio_mime']);

/**
 * @template T
 * @param value - exercise payload that may carry inline base64 audio
 * @returns deep copy without audio_b64 and audio_mime keys, safe to persist
 */
export function withoutAudio<T>(value: T): T {
  if (Array.isArray(value)) return value.map((entry) => withoutAudio(entry)) as T;
  if (value === null || typeof value !== 'object') return value;
  const copy: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!AUDIO_KEYS.has(key)) copy[key] = withoutAudio(entry);
  }
  return copy as T;
}
