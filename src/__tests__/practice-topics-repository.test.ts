import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls: Record<string, unknown[]> = {};
let result: { data: unknown; error: unknown } = { data: [], error: null };

function builder() {
  const chain: Record<string, unknown> = {};
  for (const name of ['select', 'eq', 'in', 'order']) {
    chain[name] = (...args: unknown[]) => {
      (calls[name] ??= []).push(args);
      return name === 'order' && (calls.order?.length ?? 0) >= 2 ? Promise.resolve(result) : chain;
    };
  }
  return chain;
}

const fromSpy = vi.fn(() => builder());
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServer: async () => ({ from: fromSpy }) }));

const ROW = {
  slug: 'food_health',
  area_slug: 'personal_life',
  area_order: 1,
  sort_order: 3,
  min_cefr_level: 'pre_a1',
  prompt_description: 'food',
};

beforeEach(() => {
  for (const k of Object.keys(calls)) delete calls[k];
  fromSpy.mockClear();
  result = { data: [ROW], error: null };
});

describe('fetchPracticeTopics', () => {
  it('una sola consulta que filtra por los niveles que alcanza el alumno y excluye b2+ para un a2', async () => {
    const { fetchPracticeTopics } = await import('@/lib/practice/topics-repository');
    const topics = await fetchPracticeTopics('a2');

    expect(fromSpy).toHaveBeenCalledTimes(1);
    expect(fromSpy).toHaveBeenCalledWith('practice_topics');
    expect(calls.in).toEqual([['min_cefr_level', ['pre_a1', 'a1', 'a2']]]);
    expect(calls.eq).toEqual([['is_active', true]]);
    expect(topics).toEqual([
      { slug: 'food_health', areaSlug: 'personal_life', areaOrder: 1, sortOrder: 3, minCefrLevel: 'pre_a1', promptDescription: 'food' },
    ]);
  });

  it('con slug anade el filtro por slug sin una segunda consulta', async () => {
    const { fetchPracticeTopics } = await import('@/lib/practice/topics-repository');
    await fetchPracticeTopics('b2', 'food_health');

    expect(fromSpy).toHaveBeenCalledTimes(1);
    expect(calls.eq).toEqual([['is_active', true], ['slug', 'food_health']]);
  });

  it('un error de base devuelve null', async () => {
    result = { data: null, error: { message: 'boom' } };
    const { fetchPracticeTopics } = await import('@/lib/practice/topics-repository');
    expect(await fetchPracticeTopics('b1')).toBeNull();
  });
});
