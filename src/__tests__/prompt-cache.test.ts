import { describe, it, expect, vi } from 'vitest';
import { createPromptCache } from '@/lib/prompts/prompt-cache';

function setup(load: (key: string) => Promise<string | null>) {
  let clock = 1_000_000;
  const cache = createPromptCache({
    load,
    now: () => clock,
    ttlMs: 300_000,
    backoffBaseMs: 15_000,
    backoffMaxMs: 120_000,
  });
  return { cache, advance: (ms: number) => { clock += ms; } };
}

describe('createPromptCache', () => {
  it('loads each key once within the TTL', async () => {
    const load = vi.fn(async (key: string) => `text:${key}`);
    const { cache, advance } = setup(load);

    expect(await cache.get('a')).toBe('text:a');
    advance(299_000);
    expect(await cache.get('a')).toBe('text:a');
    expect(await cache.get('b')).toBe('text:b');

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('reloads a key after the TTL expires', async () => {
    const load = vi.fn(async () => 'v');
    const { cache, advance } = setup(load);

    await cache.get('a');
    advance(300_001);
    await cache.get('a');

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('caches keys missing from the database so they fall back without re-querying', async () => {
    const load = vi.fn(async () => null);
    const { cache } = setup(load);

    expect(await cache.get('ghost')).toBeUndefined();
    expect(await cache.get('ghost')).toBeUndefined();

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent loads of the same key', async () => {
    let release: (v: string) => void = () => undefined;
    const load = vi.fn(() => new Promise<string>((resolve) => { release = resolve; }));
    const { cache } = setup(load);

    const first = cache.get('a');
    const second = cache.get('a');
    release('x');

    expect(await first).toBe('x');
    expect(await second).toBe('x');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not retry on every call when the database fails (backoff)', async () => {
    const load = vi.fn(async () => { throw new Error('down'); });
    const { cache, advance } = setup(load);

    for (let i = 0; i < 20; i += 1) expect(await cache.get(`k${i}`)).toBeUndefined();
    expect(load).toHaveBeenCalledTimes(1);

    advance(15_001);
    await cache.get('again');
    expect(load).toHaveBeenCalledTimes(2);

    advance(15_001);
    await cache.get('again');
    expect(load).toHaveBeenCalledTimes(2);

    advance(15_000);
    await cache.get('again');
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('serves the stale value while the database is failing and recovers afterwards', async () => {
    let healthy = true;
    const load = vi.fn(async () => {
      if (!healthy) throw new Error('down');
      return 'fresh';
    });
    const { cache, advance } = setup(load);

    expect(await cache.get('a')).toBe('fresh');
    healthy = false;
    advance(300_001);
    expect(await cache.get('a')).toBe('fresh');

    healthy = true;
    advance(15_001);
    expect(await cache.get('a')).toBe('fresh');
    expect(load).toHaveBeenCalledTimes(3);
  });
});
