import { createSupabaseServer } from '@/lib/supabase/server';
import { type CacheKey, hashCacheKey } from '@/lib/cache-keys';
import type { ActionResult } from '@/lib/result';

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
    .from('generation_cache')
    .select('output_text, output_json, output_blob_url, hit_count')
    .eq('cache_key', cacheKey)
    .maybeSingle();

  if (error || !data) return null;
  return extractOutput<T>(data as CacheRow, storeAs);
}

export interface CachedContentOptions<T> {
  storeAs?: StoreAs;
  validate: (value: T) => boolean;
}

function logCacheError(event: string, cacheKey: string, error: { message: string } | null): void {
  if (error) console.error(JSON.stringify({ event, cacheKey, error: error.message }));
}

/**
 * Return cached output for key if it passes validate; otherwise call producer.
 * A failed producer result yields { error } and is never persisted. A produced value
 * that fails validate is returned to the caller but never persisted.
 */
export async function getOrCreateCachedContent<T>(
  key: CacheKey,
  producer: () => Promise<ActionResult<T>>,
  options: CachedContentOptions<T>
): Promise<T | { error: string }> {
  const storeAs = options.storeAs ?? 'json';
  const cacheKey = hashCacheKey(key);
  const supabase = await createSupabaseServer();

  const { data: existing, error: readError } = await supabase
    .from('generation_cache')
    .select('output_text, output_json, output_blob_url, hit_count')
    .eq('cache_key', cacheKey)
    .maybeSingle();
  logCacheError('cache_read_failed', cacheKey, readError);

  if (existing) {
    const row = existing as CacheRow;
    const hit = extractOutput<T>(row, storeAs);
    if (hit !== null && options.validate(hit)) {
      void supabase
        .from('generation_cache')
        .update({ hit_count: row.hit_count + 1, last_hit_at: new Date().toISOString() })
        .eq('cache_key', cacheKey)
        .then(({ error }) => logCacheError('cache_hit_update_failed', cacheKey, error));
      return hit;
    }
    const { error: deleteError } = await supabase.from('generation_cache').delete().eq('cache_key', cacheKey);
    logCacheError('cache_invalid_delete_failed', cacheKey, deleteError);
  }

  let produced: ActionResult<T>;
  try {
    produced = await producer();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }
  if (!produced.ok) return { error: produced.code };
  if (!options.validate(produced.data)) return produced.data;

  const payload = buildInsertPayload(key, cacheKey, produced.data, storeAs);
  const { error: upsertError } = await supabase.from('generation_cache').upsert(payload, { onConflict: 'cache_key' });
  logCacheError('cache_upsert_failed', cacheKey, upsertError);

  return produced.data;
}

/** Remove a single cache entry by key. */
export async function invalidateCacheKey(key: CacheKey): Promise<void> {
  const cacheKey = hashCacheKey(key);
  const supabase = await createSupabaseServer();
  const { error } = await supabase.from('generation_cache').delete().eq('cache_key', cacheKey);
  logCacheError('cache_invalidate_failed', cacheKey, error);
}
