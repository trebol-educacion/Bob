// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

import { scoreHeadlineTier } from '@/lib/writing/score-headline';
import { ScoreHeadline } from '@/components/practice/writing/FceScoreCard';
import messages from '../../messages/en/cambridge.json';

afterEach(cleanup);

describe('scoreHeadlineTier', () => {
  it.each([
    [10, 'excellent'],
    [8, 'excellent'],
    [7.9, 'good'],
    [6, 'good'],
    [5.5, 'fair'],
    [4, 'fair'],
    [3.9, 'keepGoing'],
    [0, 'keepGoing'],
  ])('%s -> %s', (score, tier) => {
    expect(scoreHeadlineTier(score)).toBe(tier);
  });

  it('every tier has an English text', () => {
    const headline = messages.fce.score.headline as Record<string, string>;
    for (const tier of ['excellent', 'good', 'fair', 'keepGoing']) {
      expect(headline[tier]).toBeTruthy();
    }
  });
});

describe('ScoreHeadline', () => {
  it('does not praise a low mark', () => {
    render(<ScoreHeadline score10={3} fallback="Great essay!" />);
    expect(screen.queryByText('Great essay!')).toBeNull();
    expect(screen.getByText('fce.score.headline.keepGoing')).toBeInTheDocument();
  });

  it('praises a high mark', () => {
    render(<ScoreHeadline score10={9} fallback="Great essay!" />);
    expect(screen.getByText('fce.score.headline.excellent')).toBeInTheDocument();
  });

  it.each([null, undefined])('falls back to the given text without a mark (%s)', (score) => {
    render(<ScoreHeadline score10={score} fallback="Great essay!" />);
    expect(screen.getByText('Great essay!')).toBeInTheDocument();
  });
});
