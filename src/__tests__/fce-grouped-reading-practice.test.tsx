// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { toPublicExercise } from '@/lib/reading/fce-grouped-public';
import { gradeExercise } from '@/lib/reading/fce-grouped-grading';
import type { FCEGroupedExercise, FCEGroupedPart } from '@/lib/reading/fce-grouped-types';
import type { BankItem, ItemGroup } from '@/lib/item-bank/types';
import * as fx from './fce-grouped-fixtures';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock('@/components/chat/BobMascotLoader', () => ({
  BobMascotLoader: ({ message }: { message: string }) => <div>{message}</div>,
}));

vi.mock('@/components/practice/yl/CelebrationCard', () => ({
  CelebrationCard: ({ score, scoreMax }: { score: number; scoreMax: number }) => (
    <div data-testid="celebration">{`${score}/${scoreMax}`}</div>
  ),
}));

const startMock = vi.fn();
const submitMock = vi.fn();

vi.mock('@/actions/modes/fce-reading-grouped', () => ({
  startFCEReadingExerciseAction: (...args: unknown[]) => startMock(...args),
  submitFCEReadingExerciseAction: (...args: unknown[]) => submitMock(...args),
}));

import { FCEGroupedReadingPractice } from '@/components/practice/fce/grouped/FCEGroupedReadingPractice';

interface Case {
  part: FCEGroupedPart;
  group: ItemGroup;
  items: BankItem[];
  answers: Record<number, string>;
}

const CASES: Case[] = [
  { part: 'fce_reading_part2', group: fx.OPEN_CLOZE_GROUP, items: fx.OPEN_CLOZE_ITEMS, answers: { 9: 'without', 10: 'in', 11: 'while' } },
  { part: 'fce_reading_part3', group: fx.WORD_FORMATION_GROUP, items: fx.WORD_FORMATION_ITEMS, answers: { 17: 'frustration', 18: 'dedication' } },
  { part: 'fce_reading_part4', group: fx.KEY_WORD_GROUP, items: fx.KEY_WORD_ITEMS, answers: { 25: 'is said to be', 26: 'have difficulty attending' } },
  { part: 'fce_reading_part5', group: fx.MULTIPLE_CHOICE_GROUP, items: fx.MULTIPLE_CHOICE_ITEMS, answers: { 31: 'A', 32: 'C' } },
  { part: 'fce_reading_part6', group: fx.GAPPED_TEXT_GROUP, items: fx.GAPPED_TEXT_ITEMS, answers: { 37: 'C', 38: 'B' } },
];

function fillAnswers(part: FCEGroupedPart, exercise: FCEGroupedExercise, answers: Record<number, string>) {
  const optionButtons = screen.queryAllByRole('button').filter((b) => /^[A-D]/.test(b.textContent ?? ''));
  exercise.items.forEach((item, index) => {
    const value = answers[item.number];
    if (part === 'fce_reading_part5') {
      fireEvent.click(optionButtons[index * 4 + 'ABCD'.indexOf(value)]);
      return;
    }
    fireEvent.change(screen.getByLabelText(`fce.grouped.gapLabel:{"number":${item.number}}`), { target: { value } });
  });
}

describe.each(CASES)('FCEGroupedReadingPractice $part', ({ part, group, items, answers }) => {
  const exercise = toPublicExercise(part, group, items);

  beforeEach(() => {
    cleanup();
    startMock.mockReset();
    submitMock.mockReset();
    startMock.mockResolvedValue({ sessionId: 'session-1', exercise });
    submitMock.mockImplementation(async (input: { answers: Record<number, string> }) => {
      return { sessionId: 'session-1', result: gradeExercise(part, items, input.answers) };
    });
  });

  it('loads the pregenerated exercise and never renders keys', async () => {
    const { container } = render(<FCEGroupedReadingPractice part={part} onBack={() => undefined} />);
    await waitFor(() => expect(screen.getByText(`fce.grouped.parts.${part}.instructions`)).toBeInTheDocument());
    expect(startMock).toHaveBeenCalledWith({ part });
    expect(container.innerHTML).not.toContain('Secret explanation');
    expect(screen.getByRole('button', { name: 'fce.grouped.submitAnswers' })).toBeDisabled();
  });

  it('submits the answers, shows the corrected result and the mark', async () => {
    render(<FCEGroupedReadingPractice part={part} onBack={() => undefined} />);
    await waitFor(() => expect(screen.getByText(`fce.grouped.parts.${part}.instructions`)).toBeInTheDocument());

    fillAnswers(part, exercise, answers);
    fireEvent.click(screen.getByRole('button', { name: 'fce.grouped.submitAnswers' }));

    const expected = gradeExercise(part, items, answers);
    await waitFor(() => expect(screen.getByTestId('celebration')).toHaveTextContent(`${expected.correct}/${expected.total}`));
    expect(submitMock).toHaveBeenCalledWith({
      sessionId: undefined,
      groupId: exercise.groupId,
      part,
      answers,
    });
    expect(screen.getByText(`fce.grouped.markLabel:{"score":${expected.score10}}`)).toBeInTheDocument();
  });
});

describe('FCEGroupedReadingPractice error handling', () => {
  beforeEach(() => {
    cleanup();
    startMock.mockReset();
  });

  it('shows a clear message with retry when the load fails and recovers on retry', async () => {
    const exercise = toPublicExercise('fce_reading_part6', fx.GAPPED_TEXT_GROUP, fx.GAPPED_TEXT_ITEMS);
    startMock.mockResolvedValueOnce({ error: 'No exercise available' });
    startMock.mockResolvedValueOnce({ sessionId: 's', exercise });

    render(<FCEGroupedReadingPractice part="fce_reading_part6" onBack={() => undefined} />);
    await waitFor(() => expect(screen.getByText('No exercise available')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'fce.grouped.retry' }));
    await waitFor(() => expect(screen.getByText('fce.grouped.sentenceBankTitle')).toBeInTheDocument());
    expect(startMock).toHaveBeenCalledTimes(2);
  });
});
