import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchSpy = vi.fn();
vi.mock('@/lib/practice/topics-repository', () => ({ fetchPracticeTopics: (...a: unknown[]) => fetchSpy(...a) }));

const TOPICS = [
  { slug: 'b', areaSlug: 'personal_life', areaOrder: 1, sortOrder: 2, minCefrLevel: 'pre_a1', promptDescription: 'b' },
  { slug: 'a', areaSlug: 'personal_life', areaOrder: 1, sortOrder: 1, minCefrLevel: 'pre_a1', promptDescription: 'a' },
];

beforeEach(() => {
  vi.resetAllMocks();
  fetchSpy.mockResolvedValue(TOPICS);
});

describe('listPracticeTopicsAction', () => {
  it('pide los topics con el nivel efectivo de speaking y los devuelve agrupados', async () => {
    const { listPracticeTopicsAction } = await import('@/actions/practice/topics');
    const result = await listPracticeTopicsAction({ skillLevels: { speaking: { cefr_level: 'a2' } } as never, cefrActiveLevel: 'c1' });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('a2');
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.data[0].topics.map((t) => t.slug)).toEqual(['a', 'b']);
  });

  it('sin nivel conocido usa el nivel por defecto', async () => {
    const { listPracticeTopicsAction } = await import('@/actions/practice/topics');
    await listPracticeTopicsAction({ skillLevels: null, cefrActiveLevel: null });
    expect(fetchSpy).toHaveBeenCalledWith('b1');
  });

  it('un fallo de lectura es reintentable y no lanza', async () => {
    fetchSpy.mockResolvedValue(null);
    const { listPracticeTopicsAction } = await import('@/actions/practice/topics');
    expect(await listPracticeTopicsAction({ skillLevels: null, cefrActiveLevel: 'a2' })).toEqual({
      ok: false,
      code: 'topics_unavailable',
      retryable: true,
    });
  });
});
