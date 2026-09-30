import { describe, it, expect } from 'vitest';
import { isAcceptedAnswer, normalizeAnswer } from '@/lib/answer-match';

describe('normalizeAnswer', () => {
  it('trims, lowercases, collapses spaces and strips accents', () => {
    expect(normalizeAnswer('  Está   BIEN ')).toBe('esta bien');
  });
});

describe('isAcceptedAnswer', () => {
  it('matches any accepted variant regardless of case and spacing', () => {
    expect(isAcceptedAnswer(' While ', ['although', 'while'])).toBe(true);
  });

  it('rejects empty input and unlisted answers', () => {
    expect(isAcceptedAnswer('   ', ['on'])).toBe(false);
    expect(isAcceptedAnswer('in', ['on'])).toBe(false);
  });
});
