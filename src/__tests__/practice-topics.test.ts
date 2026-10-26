import { describe, it, expect } from 'vitest';
import { buildTopicSeed, groupTopicsByArea, levelsReachableFrom, type PracticeTopic } from '@/lib/practice/topics';

function topic(slug: string, areaOrder: number, sortOrder: number, areaSlug: PracticeTopic['areaSlug']): PracticeTopic {
  return { slug, areaSlug, areaOrder, sortOrder, minCefrLevel: 'a2', promptDescription: `desc ${slug}` };
}

describe('levelsReachableFrom', () => {
  it('un a2 alcanza hasta a2 y nunca b2 ni superiores', () => {
    expect(levelsReachableFrom('a2')).toEqual(['pre_a1', 'a1', 'a2']);
  });

  it('un b2 alcanza los topics de b2 pero no de c1', () => {
    const reachable = levelsReachableFrom('b2');
    expect(reachable).toContain('b2');
    expect(reachable).not.toContain('c1');
  });

  it('c2 alcanza todos los niveles', () => {
    expect(levelsReachableFrom('c2')).toHaveLength(7);
  });
});

describe('groupTopicsByArea', () => {
  it('agrupa por area y ordena por area y posicion aunque lleguen desordenados', () => {
    const grouped = groupTopicsByArea([
      topic('c', 2, 1, 'education_work'),
      topic('b', 1, 2, 'personal_life'),
      topic('a', 1, 1, 'personal_life'),
    ]);

    expect(grouped.map((g) => g.areaSlug)).toEqual(['personal_life', 'education_work']);
    expect(grouped[0].topics.map((t) => t.slug)).toEqual(['a', 'b']);
  });

  it('una lista vacia no produce areas', () => {
    expect(groupTopicsByArea([])).toEqual([]);
  });
});

describe('buildTopicSeed', () => {
  it('usa la descripcion del topic como topic de la seed', () => {
    expect(buildTopicSeed(topic('x', 1, 1, 'personal_life')).topic).toBe('desc x');
  });
});
