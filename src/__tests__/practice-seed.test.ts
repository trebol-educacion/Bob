import { describe, it, expect } from 'vitest';
import { pickPracticeSeed } from '@/lib/practice/seed';

describe('pickPracticeSeed', () => {
  it('es determinista para el mismo rng', () => {
    const rng = () => 0.1;
    const a = pickPracticeSeed('conversation', rng);
    const b = pickPracticeSeed('conversation', rng);
    expect(a).toEqual(b);
  });

  it('dos rng distintos dan combinaciones distintas', () => {
    const a = pickPracticeSeed('conversation', () => 0.05);
    const b = pickPracticeSeed('conversation', () => 0.95);
    expect(a).not.toEqual(b);
  });

  it('situation saca el topic del pool de situaciones', () => {
    const seed = pickPracticeSeed('situation', () => 0.4);
    expect(seed.topic).toBe('introducing yourself to someone new');
  });

  it('picture saca el topic del pool de imagenes', () => {
    const seed = pickPracticeSeed('picture', () => 0.4);
    expect(seed.topic).toBe('a classroom during an art lesson');
  });

  it('conversation compone el topic a partir de character y angle', () => {
    const seed = pickPracticeSeed('conversation', () => 0);
    expect(seed.topic).toContain(seed.character);
  });
});
