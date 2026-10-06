import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const completeMock = vi.fn();
const createSessionMock = vi.fn();
const geminiMock = vi.fn();
const promptMock = vi.fn();

vi.mock('@/lib/session/complete', () => ({ completeActivity: (...a: unknown[]) => completeMock(...a) }));
vi.mock('@/lib/session/lifecycle', () => ({ currentUserId: async () => 'user-1' }));
vi.mock('@/actions/sessions', () => ({ createSessionAction: (...a: unknown[]) => createSessionMock(...a) }));
vi.mock('@/lib/prompts/db-prompts', () => ({ getPrompt: (...a: unknown[]) => promptMock(...a) }));
vi.mock('@/lib/gemini-client', () => ({
  callGemini: (...a: unknown[]) => geminiMock(...a),
  isOk: (result: { ok: boolean }) => result.ok,
}));
vi.mock('@/actions/modes/yl', () => ({ generateYLImagesParallelAction: vi.fn() }));

import { generateKETShortMessageAction, evaluateKETShortMessageAction } from '@/actions/modes/ket-writing-part6';
import { generateKETPictureStoryPlanAction, evaluateKETPictureStoryAction } from '@/actions/modes/ket-writing-part7';
import { restorePictureStory, restoreShortMessage } from '@/lib/ket/writing-restore';

const EVALUATION = {
  understood: true,
  highlights: ['h'],
  suggestions: ['s'],
  model_answer: 'model',
  rubric: { task_coverage: 4, grammar: 4, vocabulary: 4, fluency: 4 },
};

function llmReturns(payload: unknown) {
  geminiMock.mockResolvedValue({
    ok: true,
    data: { candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] },
  });
}

const PROMPT = { scenario: 'sc', recipient: 'Tom', contentPoints: ['a', 'b'], wordTarget: 25, framingText: 'f' };

const CASES = [
  {
    mode: 'cambridge_ket_writing_part6',
    planKind: 'writing_prompt',
    generate: () => generateKETShortMessageAction(),
    evaluate: () => evaluateKETShortMessageAction({ prompt: PROMPT, userText: 'my message' }),
  },
  {
    mode: 'cambridge_ket_writing_part7',
    planKind: 'picture_story_prompt',
    generate: () => generateKETPictureStoryPlanAction(),
    evaluate: () =>
      evaluateKETPictureStoryAction({
        userText: 'my story',
        story_premise: 'p',
        framing_text: 'f',
        scenes: [{ number: 1, description: 'd', image_prompt: 'i' }],
        image_urls: ['u'],
      }),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  promptMock.mockResolvedValue('{SCENARIO} {STORY_PREMISE} {SCENES} {USER_TEXT}');
  completeMock.mockResolvedValue({ ok: true, data: { sessionId: 'new-session', score10: 10 } });
});

describe.each(CASES)('$mode', ({ mode, planKind, generate, evaluate }) => {
  it('generate no crea sesión ni persiste', async () => {
    geminiMock.mockResolvedValue({ ok: false });
    await generate();
    expect(createSessionMock).not.toHaveBeenCalled();
    expect(completeMock).not.toHaveBeenCalled();
  });

  it('evalúa primero y cierra con completeActivity con la rúbrica', async () => {
    llmReturns(EVALUATION);
    const result = await evaluate();
    expect(completeMock).toHaveBeenCalledTimes(1);
    const call = completeMock.mock.calls[0][0];
    expect(call.mode).toBe(mode);
    expect(call.plan.kind).toBe(planKind);
    expect(call.evaluation.rubric).toEqual(EVALUATION.rubric);
    expect(call.answerTexts).toHaveLength(1);
    expect(result).toMatchObject({ sessionId: 'new-session' });
  });

  it('si la evaluación falla no crea ni cierra la sesión', async () => {
    geminiMock.mockResolvedValue({ ok: false });
    const result = await evaluate();
    expect(result).toHaveProperty('error');
    expect(completeMock).not.toHaveBeenCalled();
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it('si la persistencia falla devuelve el error', async () => {
    llmReturns(EVALUATION);
    completeMock.mockResolvedValue({ ok: false, code: 'persist_failed', retryable: true });
    expect(await evaluate()).toEqual({ error: 'persist_failed' });
  });
});

describe('restauración de writing', () => {
  it('Part 6 reconstruye consigna, texto y feedback', () => {
    const restored = restoreShortMessage([
      { role: 'bob', msg_type: 'text', content_json: { kind: 'writing_prompt', scenario: 'sc', recipient: 'Tom', content_points: ['a'], word_target: 25, framing_text: 'f' } },
      { role: 'user', msg_type: 'text', content_text: 'hi', content_json: { kind: 'writing_submission', text: 'hi' } },
      { role: 'bob', msg_type: 'evaluation', content_json: { is_final: true, understood: true, highlights: ['h'], suggestions: [], modelAnswer: 'm' } },
    ] as never);
    expect(restored.prompt?.scenario).toBe('sc');
    expect(restored.userText).toBe('hi');
    expect(restored.feedback?.modelAnswer).toBe('m');
  });

  it('Part 7 reconstruye escenas con imágenes y devuelve null sin plan', () => {
    const restored = restorePictureStory([
      { role: 'bob', msg_type: 'text', content_json: { kind: 'picture_story_prompt', story_premise: 'p', framing_text: 'f', scenes: [{ number: 1, description: 'd', image_prompt: 'i' }], image_urls: ['u'] } },
      { role: 'user', msg_type: 'text', content_text: 'story', content_json: null },
      { role: 'bob', msg_type: 'evaluation', content_json: { is_final: true, understood: true, highlights: [], suggestions: [], model_answer: 'm' } },
    ] as never);
    expect(restored?.scenes[0].image_url).toBe('u');
    expect(restored?.userText).toBe('story');
    expect(restored?.feedback?.model_answer).toBe('m');
    expect(restorePictureStory([] as never)).toBeNull();
  });
});
