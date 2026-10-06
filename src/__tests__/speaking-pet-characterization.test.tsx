// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { StoredMessage } from '@/actions/messages';

vi.mock('server-only', () => ({}));
vi.mock('@/components/practice/yl/_shared', () => ({ BobAvatar: () => <span data-testid="bob-avatar" /> }));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock('motion/react', async () => {
  const React = await import('react');
  const omitted = new Set(['initial', 'animate', 'exit', 'transition', 'whileTap', 'whileHover', 'layout']);
  const cache = new Map<string, React.FC<Record<string, unknown>>>();
  const motion = new Proxy(
    {},
    {
      get: (_t, tag: string) => {
        const cached = cache.get(tag);
        if (cached) return cached;
        const component: React.FC<Record<string, unknown>> = (props) =>
          React.createElement(
            tag,
            Object.fromEntries(Object.entries(props).filter(([key]) => !omitted.has(key))),
          );
        cache.set(tag, component);
        return component;
      },
    },
  );
  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useReducedMotion: () => false,
  };
});

vi.mock('@/components/chat/BobMascotLoader', () => ({
  BobMascotLoader: ({ message }: { message: string }) => <div>{message}</div>,
}));

vi.mock('@/lib/audio', () => ({ blobToBase64: async () => 'b64' }));

const recorder: {
  opts: { onRecorded: (blob: Blob) => void; onError?: (error: Error) => void } | null;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
} = { opts: null, start: vi.fn(), stop: vi.fn() };

vi.mock('@/hooks/useAudioRecorder', () => ({
  useAudioRecorder: (opts: NonNullable<typeof recorder.opts>) => {
    recorder.opts = opts;
    return {
      isRecording: false,
      elapsedSeconds: 0,
      startRecording: recorder.start,
      stopRecording: recorder.stop,
    };
  },
}));

const ttsStart = vi.fn();
const ttsStop = vi.fn();
vi.mock('@/hooks/useTTS', () => ({
  useTTS: () => ({ start: ttsStart, stop: ttsStop, play: vi.fn(), playUrl: vi.fn() }),
}));

const p1Generate = vi.fn();
const p1Process = vi.fn();
const p1Evaluate = vi.fn();
vi.mock('@/actions/modes/pet-p1', () => ({
  generatePETInterviewAction: (...args: unknown[]) => p1Generate(...args),
  processPETInterviewAnswerAction: (...args: unknown[]) => p1Process(...args),
  evaluatePETInterviewAction: (...args: unknown[]) => p1Evaluate(...args),
}));

const p4Generate = vi.fn();
const p4Process = vi.fn();
const p4Evaluate = vi.fn();
vi.mock('@/actions/modes/pet-p4', () => ({
  generatePETDiscussionAction: (...args: unknown[]) => p4Generate(...args),
  processPETDiscussionAnswerAction: (...args: unknown[]) => p4Process(...args),
  evaluatePETDiscussionAction: (...args: unknown[]) => p4Evaluate(...args),
}));

const p3Scenario = vi.fn();
const p3Audio = vi.fn();
const p3Text = vi.fn();
const p3Evaluate = vi.fn();
vi.mock('@/actions/modes/part3', () => ({
  generatePart3ScenarioAction: (...args: unknown[]) => p3Scenario(...args),
  chatPart3Action: (...args: unknown[]) => p3Audio(...args),
  chatPart3TextAction: (...args: unknown[]) => p3Text(...args),
  evaluatePart3Action: (...args: unknown[]) => p3Evaluate(...args),
}));

import { PETInterviewPractice } from '@/components/PETInterviewPractice';
import { PETDiscussionPractice } from '@/components/PETDiscussionPractice';
import { B1CollaborativePractice } from '@/components/B1CollaborativePractice';

const feedback = {
  kind: 'formative' as const,
  understood: true,
  highlights: ['h1', 'h2'],
  suggestions: ['s1', 's2'],
  model_answer: 'model sentence',
};

const interviewPlan = {
  phase1_questions: ['Q-phase1'],
  topicA: 'Topic A',
  topicA_questions: ['Q-topicA'],
  topicA_followup: 'Q-topicA-follow',
  topicBC: 'Topic BC',
  topicBC_questions: ['Q-topicBC'],
  topicBC_followup: 'Q-topicBC-follow',
  closing: 'Bye',
};

const interviewQuestions = ['Q-phase1', 'Q-topicA', 'Q-topicA-follow', 'Q-topicBC', 'Q-topicBC-follow'];

const discussionPlan = {
  topic: 'Free time',
  link: 'Link sentence',
  questions: ['D-one', 'D-two'],
  closing: 'Bye',
};

const answered = (transcribed: string, reaction: string) => ({
  ok: true as const,
  data: { transcribed, reaction, sessionId: 'sess-1' },
});

const evaluated = { ok: true as const, data: { feedback, sessionId: 'sess-1' } };

const audioBlob = () => new Blob(['x'.repeat(1024)], { type: 'audio/webm' });

async function recordAnswer() {
  fireEvent.click(await screen.findByLabelText('Record your answer'));
  await waitFor(() => expect(recorder.start).toHaveBeenCalled());
  await act(async () => {
    recorder.opts?.onRecorded(audioBlob());
  });
  return screen.findByText('Send it!');
}

beforeEach(() => {
  vi.clearAllMocks();
  recorder.opts = null;
  recorder.start.mockResolvedValue(undefined);
  ttsStart.mockResolvedValue(undefined);
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('PETInterviewPractice characterization (Speaking P1)', () => {
  beforeEach(() => {
    p1Generate.mockResolvedValue(interviewPlan);
    p1Process.mockResolvedValue(answered('my answer', ''));
    p1Evaluate.mockResolvedValue(evaluated);
  });

  it('boots the session and renders the first question', async () => {
    const { container } = render(<PETInterviewPractice onBack={vi.fn()} />);
    await screen.findByText('Q-phase1');
    expect(p1Generate).toHaveBeenCalledWith();
    expect(p1Process).not.toHaveBeenCalled();
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('review step then a full run sends each answer and evaluates the transcript', async () => {
    p1Process.mockResolvedValueOnce(answered('my answer', 'Nice!'));
    const { container } = render(<PETInterviewPractice onBack={vi.fn()} />);
    fireEvent.click(await recordAnswer());
    expect(container.innerHTML).toMatchSnapshot();
    await waitFor(() =>
      expect(p1Process).toHaveBeenCalledWith('b64', 'audio/webm', 'Q-phase1', { sessionId: undefined, plan: interviewPlan }),
    );
    await screen.findByText('Nice!');
    expect(ttsStart).toHaveBeenCalledWith('Nice!');
    expect(container.innerHTML).toMatchSnapshot();
    for (const question of interviewQuestions.slice(1)) {
      await screen.findByText(question, undefined, { timeout: 3000 });
      fireEvent.click(await recordAnswer());
    }
    await screen.findByText('Interview complete!', undefined, { timeout: 3000 });
    expect(p1Evaluate).toHaveBeenCalledWith(
      interviewQuestions.map((question) => ({ question, answer: 'my answer' })),
      { sessionId: 'sess-1', plan: interviewPlan },
    );
    expect(container.innerHTML).toMatchSnapshot();
  }, 20000);

  it('processing failure shows the error screen with retry', async () => {
    p1Process.mockRejectedValueOnce(new Error('boom'));
    const { container } = render(<PETInterviewPractice onBack={vi.fn()} />);
    fireEvent.click(await recordAnswer());
    await screen.findByText('boom');
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('microphone denial shows the mic screen', async () => {
    const { container } = render(<PETInterviewPractice onBack={vi.fn()} />);
    await screen.findByText('Q-phase1');
    await act(async () => {
      recorder.opts?.onError?.(new Error('Permission denied'));
    });
    await screen.findByText("We can't hear you yet");
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('hear-the-question and retry behave as before', async () => {
    const { container } = render(<PETInterviewPractice onBack={vi.fn()} />);
    fireEvent.click(await screen.findByText('Hear the question'));
    await waitFor(() => expect(ttsStart).toHaveBeenCalledWith('Q-phase1'));
    fireEvent.click(await screen.findByText('Stop'));
    expect(ttsStop).toHaveBeenCalled();
    await recordAnswer();
    fireEvent.click(screen.getByText('common.tryAgain'));
    await screen.findByLabelText('Record your answer');
    expect(container.innerHTML).toMatchSnapshot();
  });
});

describe('PETDiscussionPractice characterization (Speaking P4)', () => {
  beforeEach(() => {
    p4Generate.mockResolvedValue(discussionPlan);
    p4Process.mockResolvedValue(answered('my answer', ''));
    p4Evaluate.mockResolvedValue(evaluated);
  });

  it('boots the session and renders topic card plus first question', async () => {
    const { container } = render(<PETDiscussionPractice onBack={vi.fn()} />);
    await screen.findByText('D-one');
    expect(p4Generate).toHaveBeenCalledWith();
    expect(screen.getByText('Free time')).toBeInTheDocument();
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('full run sends answers, hides the topic card after the first question and evaluates', async () => {
    const { container } = render(<PETDiscussionPractice onBack={vi.fn()} />);
    fireEvent.click(await recordAnswer());
    await waitFor(() =>
      expect(p4Process).toHaveBeenCalledWith('b64', 'audio/webm', 'D-one', { sessionId: undefined, plan: discussionPlan }),
    );
    await screen.findByText('D-two', undefined, { timeout: 3000 });
    expect(screen.queryByText('Free time')).not.toBeInTheDocument();
    expect(container.innerHTML).toMatchSnapshot();
    fireEvent.click(await recordAnswer());
    await screen.findByText('Discussion complete!', undefined, { timeout: 3000 });
    expect(p4Evaluate).toHaveBeenCalledWith(
      [
        { question: 'D-one', answer: 'my answer' },
        { question: 'D-two', answer: 'my answer' },
      ],
      { sessionId: 'sess-1', plan: discussionPlan },
    );
    expect(container.innerHTML).toMatchSnapshot();
  }, 20000);

  it('plan generation failure shows the error screen', async () => {
    p4Generate.mockRejectedValueOnce(new Error('no plan'));
    const { container } = render(<PETDiscussionPractice onBack={vi.fn()} />);
    await screen.findByText('no plan');
    expect(container.innerHTML).toMatchSnapshot();
  });
});

describe('B1CollaborativePractice characterization (Speaking P3)', () => {
  beforeEach(() => {
    p3Audio.mockResolvedValue({
      ok: true,
      data: { transcribed: 'Let us go and visit', examinerResponse: 'Why is that?', sessionId: 'sess-1' },
    });
    p3Text.mockResolvedValue({ ok: true, data: { examinerResponse: 'Interesting.', sessionId: 'sess-1' } });
    p3Evaluate.mockResolvedValue({ ok: true, data: { feedback, sessionId: 'sess-1' } });
  });

  async function startWithFirstPreset() {
    const view = render(<B1CollaborativePractice onBack={vi.fn()} />);
    fireEvent.click(screen.getByText('Planning a Class Trip'));
    fireEvent.click(await screen.findByText('b1.collaborative.startDiscussion'));
    await screen.findByText(/Let's talk about "Planning a Class Trip"/);
    return view;
  }

  it('intro renders presets, and selecting one shows options and start', async () => {
    const { container } = render(<B1CollaborativePractice onBack={vi.fn()} />);
    expect(container.innerHTML).toMatchSnapshot();
    fireEvent.click(screen.getByText('Planning a Class Trip'));
    await screen.findByText('b1.collaborative.startDiscussion');
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('surprise me uses the generated scenario and falls back to a preset on failure', async () => {
    p3Scenario.mockResolvedValueOnce({
      topic: 'Generated topic',
      situation: 'Generated situation',
      prompt_question: 'Generated question?',
      options: ['a', 'b', 'c', 'd', 'e'],
    });
    render(<B1CollaborativePractice onBack={vi.fn()} />);
    fireEvent.click(screen.getByText('b1.collaborative.surpriseMe'));
    await screen.findByText('Generated situation');
    expect(p3Scenario).toHaveBeenCalledWith();
    p3Scenario.mockRejectedValueOnce(new Error('fail'));
    fireEvent.click(screen.getByText('b1.collaborative.surpriseMe'));
    await waitFor(() => expect(screen.queryByText('Generated situation')).not.toBeInTheDocument());
  });

  it('start opens with the examiner line and speaks it without creating a session', async () => {
    const { container } = await startWithFirstPreset();
    expect(p3Audio).not.toHaveBeenCalled();
    expect(p3Text).not.toHaveBeenCalled();
    const opening =
      'Let\'s talk about "Planning a Class Trip". Your class is planning a one-day trip. You need to decide which activities to include. Which activities would be most fun and educational for the class?';
    expect(ttsStart).toHaveBeenCalledWith(opening);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('audio and text turns call the actions, then finish early evaluates and shows feedback', async () => {
    const { container } = await startWithFirstPreset();
    await act(async () => {
      recorder.opts?.onRecorded(audioBlob());
    });
    await screen.findByText('Why is that?');
    expect(p3Audio).toHaveBeenCalledWith(
      'b64',
      'audio/webm;codecs=opus',
      [expect.objectContaining({ role: 'examiner' })],
      expect.objectContaining({ topic: 'Planning a Class Trip' }),
      undefined,
    );
    expect(container.innerHTML).toMatchSnapshot();
    for (let turn = 0; turn < 3; turn += 1) {
      fireEvent.click(screen.getByText('b1.collaborative.typeInstead'));
      fireEvent.change(await screen.findByPlaceholderText('Type your response…'), {
        target: { value: `text ${turn}` },
      });
      fireEvent.click(screen.getByText('common.send'));
      await waitFor(() => expect(p3Text).toHaveBeenCalledTimes(turn + 1));
      await waitFor(() => expect(screen.getByText('b1.collaborative.turnOf:{"current":' + (turn + 2) + ',"max":8}')).toBeInTheDocument());
    }
    expect(p3Text).toHaveBeenLastCalledWith(
      'text 2',
      expect.any(Array),
      expect.objectContaining({ topic: 'Planning a Class Trip' }),
      'sess-1',
    );
    expect(container.innerHTML).toMatchSnapshot();
    fireEvent.click(await screen.findByText('b1.collaborative.finishEarly'));
    await screen.findByText('Great discussion, your ideas came through clearly!');
    expect(p3Evaluate).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ topic: 'Planning a Class Trip' }),
      'sess-1',
    );
    expect(p3Evaluate.mock.calls[0][0]).toHaveLength(9);
    expect(container.innerHTML).toMatchSnapshot();
  }, 20000);

  it('restores a finished session from the stored messages', async () => {
    const scenario = {
      topic: 'Planning a Class Trip',
      situation: 'Your class is planning a trip.',
      prompt_question: 'Which activities?',
      options: ['a', 'b', 'c', 'd', 'e'],
    };
    const stored = [
      { role: 'bob', msg_type: 'phrase', content_json: scenario },
      { role: 'bob', msg_type: 'text', content_text: 'Opening' },
      { role: 'user', msg_type: 'text', content_text: 'Answer' },
      { role: 'bob', msg_type: 'evaluation', content_json: { ...feedback, is_final: true } },
    ] as unknown as StoredMessage[];
    const { container } = render(
      <B1CollaborativePractice onBack={vi.fn()} sessionId="restored-1" initialMessages={stored} />,
    );
    await screen.findByText('Great discussion, your ideas came through clearly!');
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('evaluation failure still shows the fallback feedback', async () => {
    p3Evaluate.mockResolvedValueOnce({ ok: false, code: 'persist_failed', retryable: true });
    await startWithFirstPreset();
    for (let turn = 0; turn < 4; turn += 1) {
      fireEvent.click(screen.getByText('b1.collaborative.typeInstead'));
      fireEvent.change(await screen.findByPlaceholderText('Type your response…'), {
        target: { value: `t${turn}` },
      });
      fireEvent.click(screen.getByText('common.send'));
      await waitFor(() => expect(p3Text).toHaveBeenCalledTimes(turn + 1));
      await waitFor(() => expect(screen.getByText('b1.collaborative.turnOf:{"current":' + (turn + 1) + ',"max":8}')).toBeInTheDocument());
    }
    fireEvent.click(await screen.findByText('b1.collaborative.finishEarly'));
    await screen.findByText('Could not generate feedback. Please try again.');
  }, 20000);
});
