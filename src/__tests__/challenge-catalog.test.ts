import { describe, expect, it } from 'vitest';
import { challengesForLevel } from '@/lib/challenge/catalog';

describe('challengesForLevel', () => {
  it('a B2 student sees B2 First first, marked as their level and coming soon', () => {
    const [first, second] = challengesForLevel('b2');
    expect(first).toMatchObject({ id: 'cambridge_b2_first', matchesLevel: true, available: false });
    expect(second).toMatchObject({ id: 'cambridge_a2_key', available: true, matchesLevel: false });
  });

  it('an A2 student gets the A2 Key as their available level', () => {
    expect(challengesForLevel('a2')[0]).toMatchObject({ id: 'cambridge_a2_key', matchesLevel: true, available: true });
  });

  it('without level the available challenges come first and none matches', () => {
    const options = challengesForLevel(null);
    expect(options[0].available).toBe(true);
    expect(options.some((option) => option.matchesLevel)).toBe(false);
  });
});
