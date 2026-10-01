// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { toGroupPayload } from '@/lib/item-bank/group-payload';
import { gradeGroupAnswers, matchesAcceptedText, matchesLetterKey } from '@/lib/item-bank/group-grading';
import {
  L2_GROUP, L2_ITEMS, L4_GROUP, L4_ITEMS,
} from './fce-group-fixtures';

vi.mock('@/components/chat/BobMascotLoader', () => ({
  BobMascotLoader: ({ message }: { message: string }) => <div>{message}</div>,
}));
vi.mock('@/components/practice/yl/CelebrationCard', () => ({
  CelebrationCard: ({ score, scoreMax }: { score: number; scoreMax: number }) => (
    <div data-testid="celebration">{`${score}/${scoreMax}`}</div>
  ),
}));

const startMocks = { l2: vi.fn(), l4: vi.fn() };
const submitMocks = { l2: vi.fn(), l4: vi.fn() };

vi.mock('@/actions/modes/fce-listening-part2', () => ({
  startFCEListeningPart2Action: (...a: unknown[]) => startMocks.l2(...a),
  submitFCEListeningPart2Action: (...a: unknown[]) => submitMocks.l2(...a),
}));
vi.mock('@/actions/modes/fce-listening-part4', () => ({
  startFCEListeningPart4Action: (...a: unknown[]) => startMocks.l4(...a),
  submitFCEListeningPart4Action: (...a: unknown[]) => submitMocks.l4(...a),
}));

import { FCEListeningGapFillPractice } from '@/components/practice/fce/FCEListeningGapFillPractice';
import { FCEListeningInterviewPractice } from '@/components/practice/fce/FCEListeningInterviewPractice';

const l2 = toGroupPayload(L2_GROUP, L2_ITEMS);
const l4 = toGroupPayload(L4_GROUP, L4_ITEMS);

const playMock = vi.fn(() => Promise.resolve());
const createdAudio: Array<{ src: string; onerror: (() => void) | null }> = [];

beforeEach(() => {
  vi.clearAllMocks();
  createdAudio.length = 0;
  vi.stubGlobal(
    'Audio',
    class {
      src: string;
      onerror: (() => void) | null = null;
      play = playMock;
      pause = vi.fn();
      constructor(src: string) {
        this.src = src;
        createdAudio.push(this);
      }
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const props = { onBack: vi.fn() };

describe('FCEListeningGapFillPractice (Listening P2)', () => {
  it('un input por hueco, corrige con accepted[] y muestra nota', async () => {
    startMocks.l2.mockResolvedValue({ sessionId: 's4', exercise: l2 });
    submitMocks.l2.mockImplementation(async (_s: string, answers: Record<string, string>) =>
      gradeGroupAnswers(L2_ITEMS, answers, matchesAcceptedText),
    );
    render(<FCEListeningGapFillPractice {...props} />);

    await screen.findByText(l2.title);
    expect(screen.getAllByRole('textbox')).toHaveLength(3);
    fireEvent.change(screen.getByLabelText('Gap 9'), { target: { value: 'Vesuvius' } });
    fireEvent.change(screen.getByLabelText('Gap 10'), { target: { value: 'AD 79' } });
    fireEvent.change(screen.getByLabelText('Gap 11'), { target: { value: 'three' } });
    fireEvent.click(screen.getByRole('button', { name: /Check answers \(3\/3\)/ }));

    await waitFor(() => expect(screen.getByTestId('score-10')).toHaveTextContent('Score: 6.7 / 10'));
    expect(screen.getByText('two')).toBeInTheDocument();
  });
});

describe('FCEListeningInterviewPractice (Listening P4)', () => {
  it('audio largo, preguntas de tres opciones, revision con la clave tras corregir', async () => {
    startMocks.l4.mockResolvedValue({ sessionId: 's5', exercise: l4 });
    submitMocks.l4.mockImplementation(async (_s: string, answers: Record<string, string>) =>
      gradeGroupAnswers(L4_ITEMS, answers, matchesLetterKey),
    );
    render(<FCEListeningInterviewPractice {...props} />);

    await screen.findByText(l4.title);
    fireEvent.click(screen.getByRole('button', { name: 'Play audio' }));
    expect(createdAudio[0].src).toContain('/fce-listening-part4/gen-l4-001.wav');
    expect(screen.getAllByRole('group')).toHaveLength(3);

    const firstGroup = screen.getAllByRole('group')[0];
    fireEvent.click(firstGroup.querySelectorAll('button')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Check answers \(1\/3\)/ }));

    await waitFor(() => expect(screen.getByTestId('score-10')).toHaveTextContent('Score: 0 / 10'));
    expect(screen.getAllByRole('group')[0].querySelectorAll('button')[1]).toHaveClass('bg-green-50');
  });
});
