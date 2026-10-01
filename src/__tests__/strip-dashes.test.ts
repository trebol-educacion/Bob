import { describe, it, expect } from 'vitest';
import { stripDashes } from '@/lib/text';

describe('stripDashes', () => {
  it('leaves ordinary letters, digits and hyphenated words untouched', () => {
    expect(stripDashes('Listen to the well-known A2 speaker')).toBe('Listen to the well-known A2 speaker');
  });

  it('replaces em, en and horizontal-bar dashes with a comma', () => {
    expect(stripDashes('Yes — sure')).toBe('Yes, sure');
    expect(stripDashes('Yes – sure')).toBe('Yes, sure');
    expect(stripDashes('Yes ― sure')).toBe('Yes, sure');
  });

  it('keeps punctuation that is not a dash', () => {
    expect(stripDashes('Where is the lift? Upstairs.')).toBe('Where is the lift? Upstairs.');
  });
});
