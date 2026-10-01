// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { StoredMessage } from '@/actions/messages';

vi.mock('@/actions/gemini', () => ({ generateSpeechAction: vi.fn() }));
vi.mock('@/actions/modes/yl', () => ({ getOrCreateCueAudioAction: vi.fn() }));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock('motion/react', async () => {
  const React = await import('react');
  const strip = ({ initial, animate, transition, ...rest }: Record<string, unknown>) => {
    void initial;
    void animate;
    void transition;
    return rest;
  };
  const motion = new Proxy(
    {},
    {
      get: (_t, tag: string) => (props: Record<string, unknown>) =>
        React.createElement(tag, strip(props)),
    },
  );
  return { motion };
});

vi.mock('@/components/chat/BobMascotLoader', () => ({
  BobMascotLoader: ({ message }: { message: string }) => <div>{message}</div>,
}));

vi.mock('@/components/practice/yl/CelebrationCard', () => ({
  CelebrationCard: ({ score, scoreMax }: { score: number; scoreMax: number }) => (
    <div data-testid="celebration">{`${score}/${scoreMax}`}</div>
  ),
}));

vi.mock('@/lib/supabase/browser-client', () => ({
  createSupabaseBrowser: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
  }),
}));

const submitMock = vi.fn();

vi.mock('@/actions/modes/fce-reading-part1', () => ({
  generateFCEClozeAction: vi.fn(),
  submitFCEClozeAnswersAction: (...args: unknown[]) => submitMock(...args),
}));

import { FCEMultipleChoiceClozePractice } from '@/components/practice/fce/FCEMultipleChoiceClozePractice';

const gaps = [1, 2].map((number) => ({
  number,
  correct_option: 'B' as const,
  explanation: `why ${number}`,
  options: (['A', 'B', 'C', 'D'] as const).map((id) => ({ id, text: `opt${number}${id}` })),
}));

const plan = {
  kind: 'cloze_plan',
  title: 'Cloze title',
  text_with_gaps: 'Start ___1___ middle ___2___ end.',
  gaps,
  framing_text: 'Framing text',
};

function message(partial: Partial<StoredMessage>): StoredMessage {
  return {
    id: 'm',
    role: 'bob',
    msg_type: 'text',
    content: '',
    content_json: null,
    ...partial,
  } as StoredMessage;
}

const planMessage = message({ content_json: plan });

const finalEvaluation = message({
  msg_type: 'evaluation',
  content_json: {
    is_final: true,
    score: 1,
    results: [
      { number: 1, chosen: 'B', correct_option: 'B', isCorrect: true, explanation: 'why 1' },
      { number: 2, chosen: 'C', correct_option: 'B', isCorrect: false, explanation: 'why 2' },
    ],
  },
});

const baseProps = { onBack: vi.fn(), onOpenDashboard: vi.fn(), onSessionFinished: vi.fn() };

describe('FCEMultipleChoiceClozePractice characterization', () => {
  beforeEach(() => {
    submitMock.mockReset();
  });

  it('ready phase: numbered badges in text, options per gap, submit disabled until all answered', async () => {
    const { container } = render(
      <FCEMultipleChoiceClozePractice {...baseProps} sessionId="s1" initialMessages={[planMessage]} />,
    );
    await screen.findByText('Framing text');
    expect(container.innerHTML).toMatchSnapshot();
    const submit = screen.getByText('fce.cloze.submitAnswers');
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByText('opt1B'));
    fireEvent.click(screen.getByText('opt2C'));
    expect(submit).toBeEnabled();
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('submit sends the chosen answers and renders the finished review', async () => {
    submitMock.mockResolvedValue({
      correctCount: 1,
      total: 2,
      results: (finalEvaluation.content_json as { results: unknown[] }).results,
    });
    const { container } = render(
      <FCEMultipleChoiceClozePractice {...baseProps} sessionId="s1" initialMessages={[planMessage]} />,
    );
    await screen.findByText('Framing text');
    fireEvent.click(screen.getByText('opt1B'));
    fireEvent.click(screen.getByText('opt2C'));
    fireEvent.click(screen.getByText('fce.cloze.submitAnswers'));
    await waitFor(() => expect(screen.getByTestId('celebration')).toBeInTheDocument());
    expect(submitMock).toHaveBeenCalledWith({
      sessionId: 's1',
      userId: 'user-1',
      answers: { 1: 'B', 2: 'C' },
      gaps,
    });
    expect(baseProps.onSessionFinished).toHaveBeenCalled();
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('restored finished session renders the review without the ready UI', async () => {
    const { container } = render(
      <FCEMultipleChoiceClozePractice
        {...baseProps}
        sessionId="s1"
        initialMessages={[planMessage, finalEvaluation]}
      />,
    );
    await screen.findByTestId('celebration');
    expect(container.innerHTML).toMatchSnapshot();
  });
});
