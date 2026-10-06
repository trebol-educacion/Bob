// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import type { StoredMessage } from '@/actions/messages';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('@/components/chat/BobMascotLoader', () => ({
  BobMascotLoader: ({ message }: { message: string }) => <div>{message}</div>,
}));
vi.mock('@/components/chat/ChatInputBar', () => ({
  ChatInputBar: ({ value, disabled, sendDisabled, onChange, onSend }: {
    value: string; disabled?: boolean; sendDisabled?: boolean; onChange: (v: string) => void; onSend: () => void;
  }) => (
    <div>
      <textarea aria-label="text" disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" disabled={disabled || sendDisabled} onClick={onSend}>send</button>
    </div>
  ),
}));
vi.mock('@/components/chat', () => ({
  InfoCard: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section><h4>{title}</h4>{children}</section>
  ),
}));
vi.mock('@/components/practice/yl/_shared', () => ({ BobAvatar: () => <span /> }));
vi.mock('@/lib/persist-activity', () => ({ persistMessage: vi.fn(() => Promise.resolve({ id: 'x' })) }));

const startMock = vi.fn();
const submitMock = vi.fn();
vi.mock('@/actions/modes/fce-writing-part2', () => ({
  startFCEWritingPart2Action: (...a: unknown[]) => startMock(...a),
  submitFCEWritingPart2Action: (...a: unknown[]) => submitMock(...a),
}));

import { FCEWritingPart2Practice } from '@/components/practice/fce/writing2/FCEWritingPart2Practice';

const TASKS = [
  { number: 2, taskType: 'article', situation: 'Situation article', register: 'informal' },
  { number: 3, taskType: 'review', situation: 'Situation review', register: 'semi-formal' },
  { number: 4, taskType: 'report', situation: 'Situation report', register: 'formal' },
];
const START = { title: 't', instructions: 'i', framingText: 'Framing text', tasks: TASKS };
const RUBRIC = { content: 4, communicative_achievement: 3, organisation: 3, language: 3 };
const FEEDBACK = {
  kind: 'writing_formative',
  understood: true,
  highlights: ['Great opening'],
  suggestions: ['Link ideas'],
  model_answer: 'Model text',
  score_10: 6.5,
  fce_rubric: RUBRIC,
  indicators: { word_count: 140, target_word_count_range: [140, 190] },
};

function words(n: number): string {
  return Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
}

beforeEach(() => {
  vi.clearAllMocks();
  startMock.mockResolvedValue(START);
  submitMock.mockResolvedValue({ sessionId: 's1', feedback: FEEDBACK });
});
afterEach(cleanup);

describe('FCEWritingPart2Practice', () => {
  it('offers the three tasks and lets the student pick one', async () => {
    render(<FCEWritingPart2Practice onBack={vi.fn()} />);
    await screen.findByText('Situation article');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Framing text')).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('fce.writing2.chooseAction')[1]);
    expect(await screen.findByText(/Situation review/)).toBeInTheDocument();
    expect(screen.queryByText('Situation article')).not.toBeInTheDocument();
  });

  it('counts words against the 140-190 range and blocks sending under 140', async () => {
    render(<FCEWritingPart2Practice onBack={vi.fn()} />);
    await screen.findByText('Situation article');
    fireEvent.click(screen.getAllByText('fce.writing2.chooseAction')[0]);
    const box = await screen.findByLabelText('text');
    fireEvent.change(box, { target: { value: words(139) } });
    expect(screen.getByText('send')).toBeDisabled();
    expect(screen.getByText('139')).toBeInTheDocument();
    expect(screen.getByText(/140-190/)).toBeInTheDocument();
    fireEvent.change(box, { target: { value: words(140) } });
    expect(screen.getByText('send')).toBeEnabled();
  });

  it('submits the chosen task and shows the 0-10 mark with formative feedback', async () => {
    const onFinished = vi.fn();
    const onCreated = vi.fn();
    render(<FCEWritingPart2Practice onBack={vi.fn()} onSessionFinished={onFinished} onSessionCreated={onCreated} />);
    await screen.findByText('Situation article');
    fireEvent.click(screen.getAllByText('fce.writing2.chooseAction')[2]);
    fireEvent.change(await screen.findByLabelText('text'), { target: { value: words(150) } });
    fireEvent.click(screen.getByText('send'));
    await waitFor(() => expect(screen.getByTestId('fce-score-10')).toHaveTextContent('6.5'));
    expect(submitMock).toHaveBeenCalledWith({ sessionId: undefined, plan: START, taskNumber: 4, text: words(150) });
    expect(onCreated).toHaveBeenCalledWith('s1');
    expect(screen.getByText('Great opening')).toBeInTheDocument();
    expect(onFinished).toHaveBeenCalled();
  });

  it('keeps the text and offers retry when the evaluation fails', async () => {
    submitMock.mockResolvedValue({ error: 'Could not evaluate your text' });
    render(<FCEWritingPart2Practice onBack={vi.fn()} />);
    await screen.findByText('Situation article');
    fireEvent.click(screen.getAllByText('fce.writing2.chooseAction')[0]);
    fireEvent.change(await screen.findByLabelText('text'), { target: { value: words(150) } });
    fireEvent.click(screen.getByText('send'));
    await screen.findByText(/Could not evaluate your text/);
    expect(screen.getByLabelText('text')).toHaveValue(words(150));
    expect(screen.getByText('send')).toBeEnabled();
  });

  it('shows a clear error with retry when the tasks cannot be generated', async () => {
    startMock.mockResolvedValueOnce({ error: 'Could not generate the exercise' });
    render(<FCEWritingPart2Practice onBack={vi.fn()} />);
    await screen.findByText('Could not generate the exercise');
    fireEvent.click(screen.getByText('fce.writing2.retry'));
    await screen.findByText('Situation article');
  });

  it('resumes at the task choice when the history has tasks but no submission', async () => {
    const messages = [
      { role: 'bob', msg_type: 'text', session_id: 's9', user_id: 'u9', content_json: { kind: 'writing_tasks', title: 't', instructions: 'i', framing_text: 'f',
        tasks: TASKS.map((t) => ({ number: t.number, task_type: t.taskType, situation: t.situation, register: t.register })) } },
    ] as unknown as StoredMessage[];
    render(<FCEWritingPart2Practice onBack={vi.fn()} sessionId="s9" initialMessages={messages} />);
    await screen.findByText('Situation article');
    fireEvent.click(screen.getAllByText('fce.writing2.chooseAction')[0]);
    fireEvent.change(await screen.findByLabelText('text'), { target: { value: words(150) } });
    fireEvent.click(screen.getByText('send'));
    await waitFor(() => expect(screen.getByTestId('fce-score-10')).toBeInTheDocument());
    expect(submitMock).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 's9', taskNumber: 2, text: words(150) }));
    expect(startMock).not.toHaveBeenCalled();
  });

  it('restores the finished result from the history without calling the model', async () => {
    const messages = [
      { role: 'bob', msg_type: 'text', content_json: { kind: 'writing_tasks', title: 't', instructions: 'i', framing_text: 'f',
        tasks: TASKS.map((t) => ({ number: t.number, task_type: t.taskType, situation: t.situation, register: t.register })) } },
      { role: 'user', msg_type: 'text', content_json: { kind: 'writing_submission', text: 'my saved text', task_number: 3 } },
      { role: 'bob', msg_type: 'evaluation', content_json: { ...FEEDBACK, is_final: true } },
    ] as unknown as StoredMessage[];
    render(<FCEWritingPart2Practice onBack={vi.fn()} sessionId="s1" initialMessages={messages} />);
    expect(await screen.findByText('my saved text')).toBeInTheDocument();
    expect(screen.getByTestId('fce-score-10')).toHaveTextContent('6.5');
    expect(screen.getByText('Situation review')).toBeInTheDocument();
    expect(startMock).not.toHaveBeenCalled();
  });
});
