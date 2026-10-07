import { describe, expect, it } from 'vitest';
import { filledExample } from '@/lib/reading/fce-cloze-bank';

const EXAMPLE = {
  number: 0,
  answer: 'B',
  sentence: 'The ___0___ of a positive mindset can transform your life.',
  options: [
    { key: 'A', label: 'strength' },
    { key: 'B', label: 'power' },
  ],
};

describe('filledExample', () => {
  it('fills gap 0 with the example answer so the text keeps its context', () => {
    expect(filledExample(EXAMPLE)).toBe('The power of a positive mindset can transform your life.');
  });

  it('returns empty without a usable example', () => {
    expect(filledExample(null)).toBe('');
    expect(filledExample({ ...EXAMPLE, answer: 'Z' })).toBe('');
  });
});
