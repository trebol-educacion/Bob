import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const existsMock = vi.fn();
const createMock = vi.fn();

vi.mock('@/lib/cache', () => ({
  getCachedContentIfExists: (...args: unknown[]) => existsMock(...args),
  getOrCreateCachedContent: (...args: unknown[]) => createMock(...args),
}));
vi.mock('@/lib/prompts/db-prompts', () => ({ getPrompt: vi.fn() }));
vi.mock('@/lib/gemini-client', () => ({ callGemini: vi.fn(), safeParseFallback: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServer: vi.fn() }));
vi.mock('@/lib/session/lifecycle', () => ({ finishSession: vi.fn(), openSession: vi.fn(), recordTurn: vi.fn() }));

import { pregenerate, selectPregenerateTargets } from '@/lib/pregenerate/b2-content';

const SCENARIO = {
  topic: 'Free time',
  situation: 'Talk about it',
  prompt_question: 'Which is best?',
  options: ['a', 'b', 'c', 'd', 'e'],
};
const client = { from: vi.fn() };

describe('pregenerate', () => {
  beforeEach(() => {
    existsMock.mockReset().mockResolvedValue(null);
    createMock.mockReset().mockResolvedValue(SCENARIO);
  });

  it('skips generation when the entry is already cached and valid', async () => {
    existsMock.mockResolvedValue(SCENARIO);
    const results = await pregenerate(selectPregenerateTargets({ config: 'cambridge_fce_p3', variant: 1 }), client);
    expect(results).toEqual([{ key: 'cambridge-fce-p3-b2-scenario', variant: 1, status: 'cached' }]);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('generates a missing entry through the admin client', async () => {
    const results = await pregenerate(selectPregenerateTargets({ config: 'cambridge_fce_p3', variant: 0 }), client);
    expect(results[0].status).toBe('generated');
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0][2].client).toBe(client);
    expect(existsMock.mock.calls[0][2]).toBe(client);
  });

  it('regenerates when the cached entry is invalid', async () => {
    existsMock.mockResolvedValue({ topic: '' });
    const results = await pregenerate(selectPregenerateTargets({ config: 'cambridge_fce_p3', variant: 0 }), client);
    expect(results[0].status).toBe('generated');
  });

  it('reports error when generation fails', async () => {
    createMock.mockResolvedValue({ error: 'timeout' });
    const results = await pregenerate(selectPregenerateTargets({ config: 'cambridge_fce_p3', variant: 0 }), client);
    expect(results[0].status).toBe('error');
  });

  it('processes every target', async () => {
    const targets = selectPregenerateTargets();
    expect(await pregenerate(targets, client)).toHaveLength(targets.length);
  });
});
