import { fail, ok } from '@/lib/result';

const upsert = vi.fn();
const deleteEq = vi.fn();
let existingRow: Record<string, unknown> | null = null;

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existingRow, error: null }) }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      delete: () => ({ eq: (...args: unknown[]) => Promise.resolve(deleteEq(...args)) }),
      upsert: (...args: unknown[]) => Promise.resolve(upsert(...args)),
    }),
  }),
}));

const KEY = { kind: 'plan', promptKey: 'test-plan', inputs: {} } as const;
const isPlan = (value: { questions: string[] }) => Array.isArray(value.questions) && value.questions.length > 0;

describe('getOrCreateCachedContent', () => {
  beforeEach(() => {
    existingRow = null;
    upsert.mockReset().mockReturnValue({ error: null });
    deleteEq.mockReset().mockReturnValue({ error: null });
  });

  it('persists a valid produced value', async () => {
    const { getOrCreateCachedContent } = await import('@/lib/cache');
    const value = { questions: ['a'] };
    const out = await getOrCreateCachedContent(KEY, async () => ok(value), { validate: isPlan });
    expect(out).toEqual(value);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('never persists a failed producer and returns an error', async () => {
    const { getOrCreateCachedContent } = await import('@/lib/cache');
    const out = await getOrCreateCachedContent(KEY, async () => fail('timeout', true), { validate: isPlan });
    expect(out).toEqual({ error: 'timeout' });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('returns but does not persist content that fails validate', async () => {
    const { getOrCreateCachedContent } = await import('@/lib/cache');
    const out = await getOrCreateCachedContent(KEY, async () => ok({ questions: [] }), { validate: isPlan });
    expect(out).toEqual({ questions: [] });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('turns a thrown producer into an error without persisting', async () => {
    const { getOrCreateCachedContent } = await import('@/lib/cache');
    const out = await getOrCreateCachedContent(
      KEY,
      async () => {
        throw new Error('boom');
      },
      { validate: isPlan },
    );
    expect(out).toEqual({ error: 'boom' });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('serves a valid hit without calling the producer', async () => {
    const { getOrCreateCachedContent } = await import('@/lib/cache');
    existingRow = { output_json: { questions: ['x'] }, output_text: null, output_blob_url: null, hit_count: 1 };
    const producer = vi.fn();
    const out = await getOrCreateCachedContent(KEY, producer, { validate: isPlan });
    expect(out).toEqual({ questions: ['x'] });
    expect(producer).not.toHaveBeenCalled();
  });

  it('deletes an invalid hit and regenerates', async () => {
    const { getOrCreateCachedContent } = await import('@/lib/cache');
    existingRow = { output_json: { questions: [] }, output_text: null, output_blob_url: null, hit_count: 1 };
    const out = await getOrCreateCachedContent(KEY, async () => ok({ questions: ['fresh'] }), { validate: isPlan });
    expect(deleteEq).toHaveBeenCalledTimes(1);
    expect(out).toEqual({ questions: ['fresh'] });
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('still returns the value when the upsert fails', async () => {
    const { getOrCreateCachedContent } = await import('@/lib/cache');
    upsert.mockReturnValue({ error: { message: 'rls' } });
    const out = await getOrCreateCachedContent(KEY, async () => ok({ questions: ['a'] }), { validate: isPlan });
    expect(out).toEqual({ questions: ['a'] });
  });
});
