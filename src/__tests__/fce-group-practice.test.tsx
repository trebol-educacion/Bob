// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { toGroupPayload } from '@/lib/item-bank/group-payload';
import { gradeGroupAnswers, matchesLetterKey } from '@/lib/item-bank/group-grading';
import { GROUP_EVALUATION_KIND, GROUP_PLAN_KIND } from '@/lib/item-bank/group-session-types';
import type { StoredMessage } from '@/actions/messages';
import {
  L3_GROUP, L3_ITEMS, R7_GROUP, R7_ITEMS,
} from './fce-group-fixtures';

vi.mock('@/components/chat/BobMascotLoader', () => ({
  BobMascotLoader: ({ message }: { message: string }) => <div>{message}</div>,
}));
vi.mock('@/components/practice/yl/CelebrationCard', () => ({
  CelebrationCard: ({ score, scoreMax }: { score: number; scoreMax: number }) => (
    <div data-testid="celebration">{`${score}/${scoreMax}`}</div>
  ),
}));

const startMocks = { r7: vi.fn(), l3: vi.fn() };
const submitMocks = { r7: vi.fn(), l3: vi.fn() };

vi.mock('@/actions/modes/fce-reading-part7', () => ({
  startFCEReadingPart7Action: (...a: unknown[]) => startMocks.r7(...a),
  submitFCEReadingPart7Action: (...a: unknown[]) => submitMocks.r7(...a),
}));
vi.mock('@/actions/modes/fce-listening-part3', () => ({
  startFCEListeningPart3Action: (...a: unknown[]) => startMocks.l3(...a),
  submitFCEListeningPart3Action: (...a: unknown[]) => submitMocks.l3(...a),
}));

import { FCEListeningMatchingPractice } from '@/components/practice/fce/FCEListeningMatchingPractice';
import { FCEReadingMatchingPractice } from '@/components/practice/fce/FCEReadingMatchingPractice';

const r7 = toGroupPayload(R7_GROUP, R7_ITEMS);
const l3 = toGroupPayload(L3_GROUP, L3_ITEMS);

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

describe('FCEReadingMatchingPractice (Reading P7)', () => {
  it('muestra cuatro secciones y 10 preguntas, admite repetir letra, corrige y muestra nota', async () => {
    startMocks.r7.mockResolvedValue({ sessionId: 's1', exercise: r7 });
    submitMocks.r7.mockImplementation(async (input: { answers: Record<string, string> }) => ({
      sessionId: 'sx',
      result: gradeGroupAnswers(R7_ITEMS, input.answers, matchesLetterKey),
      }),
    );
    render(<FCEReadingMatchingPractice {...props} />);

    await screen.findByText(r7.title);
    expect(screen.getByText(/sustainable living journey feeling quite lost/)).toBeInTheDocument();
    expect(screen.getAllByRole('group')).toHaveLength(10);

    fireEvent.click(screen.getByLabelText('Question 43: A'));
    fireEvent.click(screen.getByLabelText('Question 50: A'));
    fireEvent.click(screen.getByLabelText('Question 52: A'));
    expect(screen.getByLabelText('Question 43: A')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Question 50: A')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: /Check answers \(3\/10\)/ }));
    await waitFor(() => expect(screen.getByTestId('score-10')).toHaveTextContent('Score: 3 / 10'));
    expect(submitMocks.r7).toHaveBeenCalledWith({ sessionId: undefined, groupId: r7.groupId, answers: { 'r7-item-1': 'A', 'r7-item-8': 'A', 'r7-item-10': 'A' } });
    expect(screen.getByLabelText('Question 44: D')).toBeDisabled();
  });

  it('sin contenido muestra mensaje claro y reintenta', async () => {
    startMocks.r7.mockResolvedValueOnce({ error: 'Could not load exercise' });
    startMocks.r7.mockResolvedValueOnce({ sessionId: 's2', exercise: r7 });
    render(<FCEReadingMatchingPractice {...props} />);

    await screen.findByText('Could not load exercise');
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    await screen.findByText(r7.title);
    expect(startMocks.r7).toHaveBeenCalledTimes(2);
  });

  it('restaura una sesion terminada desde los mensajes', async () => {
    const messages = [
      { role: 'bob', msg_type: 'text', content_json: { kind: GROUP_PLAN_KIND, exercise: r7 } },
      {
        role: 'bob',
        msg_type: 'evaluation',
        content_json: {
          kind: GROUP_EVALUATION_KIND, is_final: true,
          result: {
            correct: 4, total: 10, score_10: 4,
            results: r7.questions.map((q, i) => ({ item_id: q.id, given: 'A', correct_key: R7_ITEMS[i].correct_key, is_correct: i < 4, explanation: null })),
          },
        },
      },
    ] as unknown as StoredMessage[];
    render(<FCEReadingMatchingPractice {...props} sessionId="s1" initialMessages={messages} />);
    await waitFor(() => expect(screen.getByTestId('score-10')).toHaveTextContent('Score: 4 / 10'));
    expect(startMocks.r7).not.toHaveBeenCalled();
  });
});

describe('FCEListeningMatchingPractice (Listening P3)', () => {
  it('cinco clips con audio individual, ocho opciones A-H y tres sobrantes', async () => {
    startMocks.l3.mockResolvedValue({ sessionId: 's3', exercise: l3 });
    submitMocks.l3.mockImplementation(async (input: { answers: Record<string, string> }) => ({
      sessionId: 'sx',
      result: gradeGroupAnswers(L3_ITEMS, input.answers, matchesLetterKey),
      }),
    );
    render(<FCEListeningMatchingPractice {...props} />);

    await screen.findByText(l3.intro as string);
    expect(screen.getAllByRole('group')).toHaveLength(5);
    expect(screen.getAllByLabelText(/^Question 19: /)).toHaveLength(8);
    expect(screen.getAllByRole('button', { name: /^Play Speaker/ })).toHaveLength(5);

    fireEvent.click(screen.getByRole('button', { name: 'Play Speaker 2' }));
    expect(createdAudio[0].src).toContain('/storage/v1/object/public/bob-listening/fce-listening-part3/gen-l3-001-s2.wav');

    for (const [n, key] of [[19, 'E'], [20, 'B'], [21, 'A'], [22, 'G'], [23, 'D']] as const) {
      fireEvent.click(screen.getByLabelText(`Question ${n}: ${key}`));
    }
    fireEvent.click(screen.getByRole('button', { name: /Check answers \(5\/5\)/ }));
    await waitFor(() => expect(screen.getByTestId('score-10')).toHaveTextContent('Score: 10 / 10'));
  });

  it('fallo de audio muestra mensaje y permite reintentar', async () => {
    startMocks.l3.mockResolvedValue({ sessionId: 's3', exercise: l3 });
    render(<FCEListeningMatchingPractice {...props} />);
    await screen.findByText(l3.intro as string);

    fireEvent.click(screen.getByRole('button', { name: 'Play Speaker 1' }));
    createdAudio[0].onerror?.();
    await screen.findByText('The audio is not available right now.');
    fireEvent.click(screen.getAllByRole('button', { name: /Try again/ })[0]);
    expect(screen.getAllByRole('button', { name: /^Play Speaker/ }).length).toBeGreaterThan(0);
  });
});
