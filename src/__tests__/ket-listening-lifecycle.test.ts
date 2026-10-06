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
vi.mock('@/actions/gemini', () => ({ generateSpeechAction: vi.fn(async () => ({ data: '', mimeType: 'audio/wav' })) }));

import { generateKETListenAndChooseAction, submitKETListenAnswersAction } from '@/actions/modes/ket-listening-part1';
import { generateKETListenCompleteAction, submitKETListenCompleteAction } from '@/actions/modes/ket-listening-part2';
import { generateKETListenDecideAction, submitKETListenDecideAction } from '@/actions/modes/ket-listening-part3';
import { generateKETShortTalksPlanAction, submitKETShortTalksAction } from '@/actions/modes/ket-listening-part4';
import { generateKETTFDSAction, submitKETTFDSAction } from '@/actions/modes/ket-listening-part5';
import { restoreExercise } from '@/lib/ket/restore-plan';
import { EMPTY_AUDIO, withoutAudio } from '@/lib/ket/plan';

const options = { A: 'a', B: 'b', C: 'c' };

const CASES = [
  {
    mode: 'cambridge_ket_listening_part1',
    planKind: 'listening_plan',
    generate: () => generateKETListenAndChooseAction(),
    submit: () =>
      submitKETListenAnswersAction({
        framingText: 'f',
        answers: { 1: 'A' },
        items: [
          {
            number: 1,
            context: 'c',
            dialogue: [{ speaker: 'M', line: 'hi' }],
            question: 'q',
            options: [{ id: 'A', description: 'd', image_prompt: 'p', image_url: 'u' }],
            correct_option: 'A',
            ...EMPTY_AUDIO,
            audio_b64: 'AUDIO',
          },
        ] as never,
      }),
  },
  {
    mode: 'cambridge_ket_listening_part2',
    planKind: 'listen_complete_plan',
    generate: () => generateKETListenCompleteAction(),
    submit: () =>
      submitKETListenCompleteAction({
        framing_text: 'f',
        answers: { 1: 'cat' },
        exercise: { context: 'c', form_title: 't', transcript: 'x', gaps: [{ number: 1, label: 'l', answer: 'cat' }] } as never,
      }),
  },
  {
    mode: 'cambridge_ket_listening_part3',
    planKind: 'listen_decide_plan',
    generate: () => generateKETListenDecideAction(),
    submit: () =>
      submitKETListenDecideAction({
        framing_text: 'f',
        answers: { 1: 'A' },
        exercise: { context: 'c', conversation: [], items: [{ number: 1, question: 'q', options, answer: 'A' }] } as never,
      }),
  },
  {
    mode: 'cambridge_ket_listening_part4',
    planKind: 'short_talks_plan',
    generate: () => generateKETShortTalksPlanAction(),
    submit: () =>
      submitKETShortTalksAction({
        framing_text: 'f',
        answers: { 1: 'A' },
        exercise: {
          people: [{ number: 1, name: 'n', monologue: 'm', correct_key: 'A', audio_b64: 'AUDIO' }],
          characteristics: [],
        } as never,
      }),
  },
  {
    mode: 'cambridge_ket_listening_part5',
    planKind: 'tfds_plan',
    generate: () => generateKETTFDSAction(),
    submit: () =>
      submitKETTFDSAction({
        framing_text: 'f',
        answers: { 1: 'T' },
        exercise: { context: 'c', audio: [], statements: [{ number: 1, text: 's', verdict: 'T' }], audio_b64: 'AUDIO' } as never,
      }),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  completeMock.mockResolvedValue({ ok: true, data: { sessionId: 'new-session', score10: 10 } });
});

describe.each(CASES)('$mode', ({ mode, planKind, generate, submit }) => {
  it('generate no crea sesión ni persiste', async () => {
    await generate();
    expect(createSessionMock).not.toHaveBeenCalled();
    expect(completeMock).not.toHaveBeenCalled();
  });

  it('submit cierra con completeActivity una vez, sin audio en el plan', async () => {
    const result = await submit();
    expect(completeMock).toHaveBeenCalledTimes(1);
    const call = completeMock.mock.calls[0][0];
    expect(call.mode).toBe(mode);
    expect(call.plan.kind).toBe(planKind);
    expect(call.plan.framing_text).toBe('f');
    expect(JSON.stringify(call.plan)).not.toContain('AUDIO');
    expect(call.evaluation.score_max).toBe(1);
    expect(call.answers).toHaveLength(1);
    expect(result).toMatchObject({ sessionId: 'new-session' });
  });

  it('submit devuelve error si la persistencia falla', async () => {
    completeMock.mockResolvedValue({ ok: false, code: 'persist_failed', retryable: true });
    expect(await submit()).toEqual({ error: 'persist_failed' });
  });
});

describe('restore y audio', () => {
  it('withoutAudio elimina audio_b64 y audio_mime en profundidad', () => {
    expect(withoutAudio({ a: [{ audio_b64: 'x', audio_mime: 'y', keep: 1 }], audio: [1] })).toEqual({ a: [{ keep: 1 }], audio: [1] });
  });

  it('restoreExercise usa exerciseKey y mapExercise', () => {
    const messages = [
      { role: 'bob', msg_type: 'text', content_json: { kind: 'listening_plan', framing_text: 'f', items: [{ number: 1 }] } },
      { role: 'bob', msg_type: 'evaluation', content_json: { is_final: true, score: 1, results: [{ n: 1 }] } },
    ];
    const restored = restoreExercise<Array<Record<string, unknown>>, unknown>(messages as never, 'listening_plan', 'results', {
      exerciseKey: 'items',
      mapExercise: (raw) => raw.map((item) => ({ ...item, ...EMPTY_AUDIO })),
    });
    expect(restored?.exercise[0]).toMatchObject({ number: 1, audio_b64: '' });
    expect(restored?.results).toEqual([{ n: 1 }]);
    expect(restored?.correctCount).toBe(1);
  });
});
