import { describe, it, expect } from 'vitest';
import { mapListeningScoreToCefr } from '@/lib/assessment/cefr-mapping';

describe('mapListeningScoreToCefr', () => {
  it('score 0/10 → pre_a1 low', () => {
    const result = mapListeningScoreToCefr(0, 10);
    expect(result.band).toBe('pre_a1');
    expect(result.confidence).toBe('low');
  });

  it('score 2/10 → pre_a1 medium (at max of pre_a1 range)', () => {
    const result = mapListeningScoreToCefr(2, 10);
    expect(result.band).toBe('pre_a1');
    expect(result.confidence).toBe('medium');
  });

  it('score 3/10 (limit a1) → a1 low', () => {
    const result = mapListeningScoreToCefr(3, 10);
    expect(result.band).toBe('a1');
    expect(result.confidence).toBe('low');
  });

  it('score 5/10 → a2 low (min of a2 range)', () => {
    const result = mapListeningScoreToCefr(5, 10);
    expect(result.band).toBe('a2');
    expect(result.confidence).toBe('low');
  });

  it('score 6/10 → a2 medium (at max of a2 range)', () => {
    const result = mapListeningScoreToCefr(6, 10);
    expect(result.band).toBe('a2');
    expect(result.confidence).toBe('medium');
  });

  it('score 9/10 → b2 low', () => {
    const result = mapListeningScoreToCefr(9, 10);
    expect(result.band).toBe('b2');
    expect(result.confidence).toBe('low');
  });

  it('score 10/10 → b2 medium (at max)', () => {
    const result = mapListeningScoreToCefr(10, 10);
    expect(result.band).toBe('b2');
    expect(result.confidence).toBe('medium');
  });

  it('normalizes non-10 totals correctly — 8/8 → b2', () => {
    const result = mapListeningScoreToCefr(8, 8);
    expect(result.band).toBe('b2');
  });

  it('normalizes non-10 totals correctly — 4/8 → a2 low', () => {
    const result = mapListeningScoreToCefr(4, 8);
    expect(result.band).toBe('a2');
    expect(result.confidence).toBe('low');
  });

  it('zero total returns pre_a1 low (guard)', () => {
    const result = mapListeningScoreToCefr(0, 0);
    expect(result.band).toBe('pre_a1');
    expect(result.confidence).toBe('low');
  });
});
