// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

import { scoreTier, toTenScale } from '@/lib/score/headline';
import ylMessages from '../../messages/en/yl.json';
import { ScoreHeadline } from '@/components/practice/writing/FceScoreCard';
import messages from '../../messages/en/cambridge.json';

afterEach(cleanup);

describe('scoreTier', () => {
  it.each([
    [10, 'perfect'],
    [8, 'great'],
    [7.9, 'good'],
    [6, 'good'],
    [5.5, 'fair'],
    [4, 'fair'],
    [3.9, 'keep'],
    [0, 'keep'],
  ])('%s -> %s', (score, tier) => {
    expect(scoreTier(score)).toBe(tier);
  });

  it('converts raw points to the 0-10 scale', () => {
    expect(toTenScale(5, 8)).toBe(6.3);
    expect(toTenScale(0, 0)).toBe(0);
  });

  it('every celebration tier has heading and sub text', () => {
    const celebration = ylMessages.celebration as Record<string, { heading?: string; sub?: string }>;
    for (const tier of ['perfect', 'great', 'good', 'fair', 'keep']) {
      expect(celebration[tier]?.heading).toBeTruthy();
      expect(celebration[tier]?.sub).toBeTruthy();
    }
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

describe('isPassingScore', () => {
  it('passes from the good tier upwards', async () => {
    const { isPassingScore } = await import('@/lib/score/headline');
    expect(isPassingScore(2.5)).toBe(false);
    expect(isPassingScore(5.9)).toBe(false);
    expect(isPassingScore(6)).toBe(true);
    expect(isPassingScore(10)).toBe(true);
  });
});
