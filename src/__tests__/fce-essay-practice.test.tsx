// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { StoredMessage } from '@/actions/messages';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/components/chat/BobMascotLoader', () => ({
  BobMascotLoader: ({ message }: { message: string }) => <div>{message}</div>,
}));
vi.mock('@/components/chat/ChatInputBar', () => ({ ChatInputBar: () => <div /> }));
vi.mock('@/components/practice/yl/_shared', () => ({ BobAvatar: () => <span /> }));
vi.mock('@/components/practice/yl/CelebrationCard', () => ({ CelebrationCard: () => <div /> }));
vi.mock('@/actions/modes/fce-writing-part1', () => ({
  generateFCEEssayAction: vi.fn(),
  evaluateFCEEssayAction: vi.fn(),
}));

import { FCEEssayWritingPractice } from '@/components/practice/fce/FCEEssayWritingPractice';

const NOTES = [
  { id: 1, label: 'Social media', description: 'd1' },
  { id: 2, label: 'Online privacy', description: 'd2' },
  { id: 3, label: 'Your own idea', description: 'd3' },
];

function history(evaluation: Record<string, unknown>): StoredMessage[] {
  return [
    { role: 'bob', msg_type: 'text', session_id: 's1', user_id: 'u1',
      content_json: { kind: 'essay_prompt', title: 'Tech', essay_question: 'q', context: 'c', notes: NOTES, framing_text: 'f' } },
    { role: 'user', msg_type: 'text', content_json: { kind: 'writing_submission', text: 'my essay' } },
    { role: 'bob', msg_type: 'evaluation',
      content_json: { understood: true, highlights: ['ok'], suggestions: [], notesCovered: [true, true, false],
        organization: 'Good', register: 'Good', modelAnswer: null, is_final: true, ...evaluation } },
  ] as unknown as StoredMessage[];
}

afterEach(cleanup);

describe('FCEEssayWritingPractice restore', () => {
  it('shows the 0-10 mark when the stored evaluation has a valid fce_rubric', async () => {
    render(
      <FCEEssayWritingPractice
        onBack={vi.fn()}
        sessionId="s1"
        initialMessages={history({
          score_10: 6.5,
          fce_rubric: { content: 4, communicative_achievement: 3, organisation: 3, language: 3 },
        })}
      />,
    );
    expect(await screen.findByText('my essay')).toBeInTheDocument();
    expect(screen.getByTestId('fce-score-10')).toHaveTextContent('6.5');
  });

  it('still restores evaluations saved before the mark existed', async () => {
    render(<FCEEssayWritingPractice onBack={vi.fn()} sessionId="s1" initialMessages={history({})} />);
    expect(await screen.findByText('my essay')).toBeInTheDocument();
    expect(screen.queryByTestId('fce-score-card')).not.toBeInTheDocument();
    expect(screen.getByText('ok')).toBeInTheDocument();
  });
});
