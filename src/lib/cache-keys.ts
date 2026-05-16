import { createHash } from 'node:crypto';

/** Identifies a cacheable LLM/TTS/image generation request. */
export interface CacheKey {
  kind: 'plan' | 'tts' | 'image' | 'scene';
  promptKey: string;
  inputs: Record<string, unknown>;
}

/** Returns a stable 24-char hex prefix of SHA-256 over the canonical serialization of key. */
export function hashCacheKey(key: CacheKey): string {
  const sortedInputs = Object.fromEntries(
    Object.entries(key.inputs).sort(([a], [b]) => a.localeCompare(b))
  );
  const canonical = JSON.stringify({ kind: key.kind, promptKey: key.promptKey, inputs: sortedInputs });
  return createHash('sha256').update(canonical, 'utf8').digest('hex').slice(0, 24);
}
