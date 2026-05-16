import { createSupabaseServer } from '@/lib/supabase/server';
import { type CacheKey, hashCacheKey } from '@/lib/cache-keys';

type StoreAs = 'text' | 'json' | 'blob';

interface CacheRow {
  output_text: string | null;
  output_json: unknown | null;
  output_blob_url: string | null;
  hit_count: number;
}

function extractOutput<T>(row: CacheRow, storeAs: StoreAs): T | null {
  if (storeAs === 'text') return (row.output_text ?? null) as T | null;
  if (storeAs === 'json') return (row.output_json ?? null) as T | null;
  return (row.output_blob_url ?? null) as T | null;
}

function buildInsertPayload(key: CacheKey, cacheKey: string, value: unknown, storeAs: StoreAs) {
  return {
    cache_key: cacheKey,
    kind: key.kind,
    prompt_key: key.promptKey,
    inputs: key.inputs,
    output_text: storeAs === 'text' ? String(value) : null,
    output_json: storeAs === 'json' ? (value as object) : null,
    output_blob_url: storeAs === 'blob' ? String(value) : null,
  };
}

/** Read a cached entry without side effects; returns null on miss or error. */
export async function getCachedContentIfExists<T>(
  key: CacheKey,
  storeAs: StoreAs = 'json'
): Promise<T | null> {
  const cacheKey = hashCacheKey(key);
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('bob_generation_cache')
    .select('output_text, output_json, output_blob_url, hit_count')
    .eq('cache_key', cacheKey)
    .maybeSingle();

  if (error || !data) return null;
  return extractOutput<T>(data as CacheRow, storeAs);
}

/**
 * Return cached output for key if present; otherwise call producer, persist, and return.
 * Per D-A4: producer errors are caught and returned as { error } — caller decides.
 */
export async function getOrCreateCachedContent<T>(
  key: CacheKey,
  producer: () => Promise<T>,
  options?: { storeAs?: StoreAs }
): Promise<T | { error: string }> {
  const storeAs = options?.storeAs ?? 'json';
  const cacheKey = hashCacheKey(key);
  const supabase = await createSupabaseServer();

  const { data: existing } = await supabase
    .from('bob_generation_cache')
    .select('output_text, output_json, output_blob_url, hit_count')
    .eq('cache_key', cacheKey)
    .maybeSingle();

  if (existing) {
    const row = existing as CacheRow;
    await supabase
      .from('bob_generation_cache')
      .update({
        hit_count: row.hit_count + 1,
        last_hit_at: new Date().toISOString(),
      })
      .eq('cache_key', cacheKey);

    const hit = extractOutput<T>(row, storeAs);
    if (hit !== null) return hit;
  }

  let produced: T;
  try {
    produced = await producer();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }

  const payload = buildInsertPayload(key, cacheKey, produced, storeAs);
  await supabase.from('bob_generation_cache').upsert(payload, { onConflict: 'cache_key' });

  return produced;
}

/** Remove a single cache entry by key. */
export async function invalidateCacheKey(key: CacheKey): Promise<void> {
  const cacheKey = hashCacheKey(key);
  const supabase = await createSupabaseServer();
  await supabase.from('bob_generation_cache').delete().eq('cache_key', cacheKey);
}
