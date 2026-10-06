export interface PromptCacheOptions {
  load: (key: string) => Promise<string | null>;
  now?: () => number;
  ttlMs?: number;
  backoffBaseMs?: number;
  backoffMaxMs?: number;
}

export interface PromptCache {
  get: (key: string) => Promise<string | undefined>;
  clear: () => void;
}

interface Entry {
  value: string | null;
  fetchedAt: number;
}

export const PROMPT_TTL_MS = 5 * 60 * 1000;
export const PROMPT_BACKOFF_BASE_MS = 15 * 1000;
export const PROMPT_BACKOFF_MAX_MS = 5 * 60 * 1000;

/**
 * @param options PromptCacheOptions
 * @returns PromptCache
 */
export function createPromptCache(options: PromptCacheOptions): PromptCache {
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? PROMPT_TTL_MS;
  const backoffBaseMs = options.backoffBaseMs ?? PROMPT_BACKOFF_BASE_MS;
  const backoffMaxMs = options.backoffMaxMs ?? PROMPT_BACKOFF_MAX_MS;

  const entries = new Map<string, Entry>();
  const inflight = new Map<string, Promise<string | undefined>>();
  let failures = 0;
  let retryAt = 0;

  const staleValue = (key: string): string | undefined => entries.get(key)?.value ?? undefined;

  const refresh = async (key: string): Promise<string | undefined> => {
    try {
      const value = await options.load(key);
      entries.set(key, { value, fetchedAt: now() });
      failures = 0;
      retryAt = 0;
      return value ?? undefined;
    } catch {
      failures += 1;
      retryAt = now() + Math.min(backoffBaseMs * 2 ** (failures - 1), backoffMaxMs);
      return staleValue(key);
    }
  };

  const get = async (key: string): Promise<string | undefined> => {
    const entry = entries.get(key);
    if (entry && now() - entry.fetchedAt < ttlMs) return entry.value ?? undefined;
    if (now() < retryAt) return staleValue(key);

    const pending = inflight.get(key);
    if (pending) return pending;

    const request = refresh(key).finally(() => inflight.delete(key));
    inflight.set(key, request);
    return request;
  };

  const clear = (): void => {
    entries.clear();
    inflight.clear();
    failures = 0;
    retryAt = 0;
  };

  return { get, clear };
}
