import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const completeMock = vi.fn();
const createSessionMock = vi.fn();

vi.mock('@/lib/session/complete', () => ({ completeActivity: (...a: unknown[]) => completeMock(...a) }));
vi.mock('@/lib/session/lifecycle', () => ({ currentUserId: async () => 'user-1' }));
vi.mock('@/actions/sessions', () => ({ createSessionAction: (...a: unknown[]) => createSessionMock(...a) }));
vi.mock('@/lib/prompts/db-prompts', () => ({ getPrompt: vi.fn(async () => 'prompt') }));
vi.mock('@/lib/gemini-client', () => ({ callGemini: vi.fn(async () => ({ ok: false })), isOk: () => false }));
vi.mock('@/actions/modes/yl', () => ({ generateYLImagesParallelAction: vi.fn() }));

import { generateKETSignsAndNoticesAction, submitKETSignsAnswersAction } from '@/actions/modes/ket-reading-part1';
import { generateKETMatchQuestionAction, submitKETMatchQuestionAction } from '@/actions/modes/ket-reading-part2';
import { generateKETLongTextAction, submitKETLongTextAction } from '@/actions/modes/ket-reading-part3';
import { generateKETVocabGapAction, submitKETVocabGapAction } from '@/actions/modes/ket-reading-part4';
import { generateKETReadingTFDSAction, submitKETReadingTFDSAction } from '@/actions/modes/ket-reading-part5';
import { restoreExercise } from '@/lib/ket/restore-plan';

const options = { A: 'a', B: 'b', C: 'c' };

const CASES = [
  {
    mode: 'cambridge_ket_reading_part1',
    generate: () => generateKETSignsAndNoticesAction(),
    submit: () =>
      submitKETSignsAnswersAction({
        framingText: 'f',
        answers: { 1: 'A' },
        items: [
          {
            number: 1,
            sign_text: 's',
            sign_context: 'c',
            question: 'q',
            options: [{ id: 'A', text: 'a' }, { id: 'B', text: 'b' }, { id: 'C', text: 'c' }],
            correct_option: 'A',
            explanation: 'e',
          },
        ],
      }),
  },
  {
    mode: 'cambridge_ket_reading_part2',
    generate: () => generateKETMatchQuestionAction(),
    submit: () =>
      submitKETMatchQuestionAction({
        framing_text: 'f',
        answers: { 1: 'A' },
        exercise: { topic: 't', texts: [], questions: [{ number: 1, text: 'q', answer: 'A' }] },
      }),
  },
  {
    mode: 'cambridge_ket_reading_part3',
    generate: () => generateKETLongTextAction(),
    submit: () =>
      submitKETLongTextAction({
        framing_text: 'f',
        answers: { 1: 'A' },
        exercise: { title: 't', text: 'x', items: [{ number: 1, question: 'q', options, answer: 'A' }] },
      }),
  },
  {
    mode: 'cambridge_ket_reading_part4',
    generate: () => generateKETVocabGapAction(),
    submit: () =>
      submitKETVocabGapAction({
        framing_text: 'f',
        answers: { 1: 'B' },
        exercise: { title: 't', text: 'x', items: [{ number: 1, options, answer: 'A' }] } as never,
      }),
  },
  {
    mode: 'cambridge_ket_reading_part5',
    generate: () => generateKETReadingTFDSAction(),
    submit: () =>
      submitKETReadingTFDSAction({
        framing_text: 'f',
        answers: { 1: 'T' },
        exercise: { title: 't', text: 'x', statements: [{ number: 1, text: 's', verdict: 'T' }] } as never,
      }),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  completeMock.mockResolvedValue({ ok: true, data: { sessionId: 'new-session', score10: 10 } });
});

describe.each(CASES)('$mode', ({ mode, generate, submit }) => {
  it('generate no crea sesión ni persiste', async () => {
    await generate();
    expect(createSessionMock).not.toHaveBeenCalled();
    expect(completeMock).not.toHaveBeenCalled();
  });

  it('submit cierra con completeActivity una sola vez y devuelve el sessionId', async () => {
    const result = await submit();
    expect(completeMock).toHaveBeenCalledTimes(1);
    const call = completeMock.mock.calls[0][0];
    expect(call.mode).toBe(mode);
    expect(call.evaluation.score_max).toBe(1);
    expect(call.plan.framing_text).toBe('f');
    expect(call.answers).toHaveLength(1);
    expect(result).toMatchObject({ sessionId: 'new-session' });
  });

  it('submit devuelve error si la persistencia falla', async () => {
    completeMock.mockResolvedValue({ ok: false, code: 'persist_failed', retryable: true });
    expect(await submit()).toEqual({ error: 'persist_failed' });
  });
});

describe('restoreExercise', () => {
  const plan = { role: 'bob', msg_type: 'text', content_json: { kind: 'reading_x_plan', framing_text: 'f', exercise: { id: 1 } } };
  const final = { role: 'bob', msg_type: 'evaluation', content_json: { is_final: true, score: 4, results_x: [{ n: 1 }] } };

  it('reconstruye plan y resultado final', () => {
    const restored = restoreExercise([plan, final] as never, 'reading_x_plan', 'results_x');
    expect(restored).toEqual({ exercise: { id: 1 }, framingText: 'f', results: [{ n: 1 }], correctCount: 4 });
  });

  it('sin evaluación deja results en null y sin plan devuelve null', () => {
    expect(restoreExercise([plan] as never, 'reading_x_plan', 'results_x')?.results).toBeNull();
    expect(restoreExercise([final] as never, 'reading_x_plan', 'results_x')).toBeNull();
  });
});
