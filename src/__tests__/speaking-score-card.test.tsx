// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';

vi.mock('motion/react', async () => {
  const React = await import('react');
  return {
    motion: new Proxy({}, { get: (_t, tag: string) => (props: Record<string, unknown>) => React.createElement(tag, {}, props.children as React.ReactNode) }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

import { FeedbackBlocks } from '@/components/practice/speaking/FeedbackBlocks';

const base = { kind: 'formative' as const, understood: true, highlights: ['h'], suggestions: ['s'] };

describe('speaking score card', () => {
  it('shows the 0-10 grade, the criteria and the written feedback', () => {
    render(
      <FeedbackBlocks
        feedback={{
          ...base,
          score10: 7.5,
          score: 15,
          score_max: 20,
          cefr_band: 'b2',
          band_per_criterion: { grammar_and_vocabulary: 4, pronunciation: 3 },
          feedback: 'Well done overall.',
        }}
      />,
    );
    expect(screen.getByTestId('speaking-score-value')).toHaveTextContent('7.5');
    expect(screen.getByText('Grammar and vocabulary')).toBeInTheDocument();
    expect(screen.getByText('Well done overall.')).toBeInTheDocument();
  });

  it('renders nothing extra for formative feedback without a grade', () => {
    render(<FeedbackBlocks feedback={base} />);
    expect(screen.queryByTestId('speaking-score')).not.toBeInTheDocument();
  });
});
