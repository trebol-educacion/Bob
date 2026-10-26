import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok } from '@/lib/result';

vi.mock('server-only', () => ({}));

const cacheMock = vi.fn();

vi.mock('@/lib/cache', () => ({
  getOrCreateCachedContent: (...args: unknown[]) => cacheMock(...args),
}));
vi.mock('@/lib/prompts/db-prompts', () => ({ getPrompt: async () => 'prompt' }));
vi.mock('@/lib/gemini-client', () => ({ callGemini: vi.fn(), safeParseFallback: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServer: vi.fn() }));
vi.mock('@/lib/session/lifecycle', () => ({ finishSession: vi.fn(), openSession: vi.fn(), recordTurn: vi.fn() }));

import {
  COLLABORATIVE_SCENARIO_POOL_SIZE,
  collaborativeScenarioKey,
  generateCollaborativeScenario,
  pickScenarioVariant,
  scenarioVariants,
} from '@/lib/speaking/collaborative';
import { FCE_COLLABORATIVE_CONFIG } from '@/lib/speaking/fce-configs';
import { hashCacheKey } from '@/lib/cache-keys';

const SCENARIO = {
  topic: 'Free time',
  situation: 'Talk about it',
  prompt_question: 'Which is best?',
  options: ['a', 'b', 'c', 'd', 'e'],
};

describe('collaborative scenario pool', () => {
  beforeEach(() => {
    cacheMock.mockReset().mockResolvedValue(SCENARIO);
  });

  it('picks a variant inside the pool from the random source', () => {
    expect(pickScenarioVariant(FCE_COLLABORATIVE_CONFIG, () => 0)).toBe(0);
    expect(pickScenarioVariant(FCE_COLLABORATIVE_CONFIG, () => 0.999)).toBe(COLLABORATIVE_SCENARIO_POOL_SIZE - 1);
  });

  it('honours a per-config pool size', () => {
    const config = { ...FCE_COLLABORATIVE_CONFIG, scenarioPoolSize: 2 };
    expect(scenarioVariants(config)).toEqual([0, 1]);
    expect(pickScenarioVariant(config, () => 0.99)).toBe(1);
  });

  it('lists every variant of the default pool', () => {
    expect(scenarioVariants(FCE_COLLABORATIVE_CONFIG)).toHaveLength(COLLABORATIVE_SCENARIO_POOL_SIZE);
  });

  it('builds a distinct cache key per variant', () => {
    const hashes = scenarioVariants(FCE_COLLABORATIVE_CONFIG).map((variant) =>
      hashCacheKey(collaborativeScenarioKey(FCE_COLLABORATIVE_CONFIG, variant)),
    );
    expect(new Set(hashes).size).toBe(COLLABORATIVE_SCENARIO_POOL_SIZE);
    expect(collaborativeScenarioKey(FCE_COLLABORATIVE_CONFIG, 3)).toEqual({
      kind: 'plan',
      promptKey: FCE_COLLABORATIVE_CONFIG.scenarioCacheKey,
      inputs: { variant: 3 },
    });
  });

  it('caches under the requested variant', async () => {
    await generateCollaborativeScenario(FCE_COLLABORATIVE_CONFIG, { variant: 4 });
    expect(cacheMock.mock.calls[0][0]).toEqual(collaborativeScenarioKey(FCE_COLLABORATIVE_CONFIG, 4));
  });

  it('returns the fallback when the cache yields an error', async () => {
    cacheMock.mockResolvedValue({ error: 'timeout' });
    const scenario = await generateCollaborativeScenario(FCE_COLLABORATIVE_CONFIG);
    expect(scenario).toEqual(FCE_COLLABORATIVE_CONFIG.scenarioFallback);
  });

  it('passes the injected client to the cache', async () => {
    const client = { from: vi.fn() };
    await generateCollaborativeScenario(FCE_COLLABORATIVE_CONFIG, { variant: 0, client });
    expect(cacheMock.mock.calls[0][2].client).toBe(client);
    expect(ok(SCENARIO).ok).toBe(true);
  });
});

describe('stored scenario validation', () => {
  it('accepts the transformed FCE shape that the parsing schema would reject', async () => {
    const { isStoredScenario } = await import('@/lib/speaking/collaborative');
    expect(FCE_COLLABORATIVE_CONFIG.scenarioSchema?.safeParse(SCENARIO).success).toBe(false);
    expect(isStoredScenario(SCENARIO)).toBe(true);
    expect(isStoredScenario({ topic: 'x' })).toBe(false);
  });
});
