import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const callGemini = vi.fn();
vi.mock('@/lib/gemini-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/gemini-client')>('@/lib/gemini-client');
  return { ...actual, callGemini: (...args: unknown[]) => callGemini(...args) };
});

const getPrompt = vi.fn();
vi.mock('@/lib/prompts/db-prompts', () => ({ getPrompt: (...args: unknown[]) => getPrompt(...args) }));

const openSession = vi.fn();
const finishSession = vi.fn();
vi.mock('@/lib/session/lifecycle', () => ({
  currentUserId: async () => 'u1',
  openSession: (...args: unknown[]) => openSession(...args),
  recordTurn: vi.fn(),
  finishSession: (...args: unknown[]) => finishSession(...args),
}));

const completeActivity = vi.fn();
vi.mock('@/lib/session/complete', () => ({ completeActivity: (...args: unknown[]) => completeActivity(...args) }));

vi.mock('@/lib/cache', () => ({ getOrCreateCachedContent: vi.fn() }));
vi.mock('@/actions/gemini', () => ({ generateSpeechAction: vi.fn() }));
vi.mock('@/actions/modes/yl', () => ({ generateYLImagesParallelAction: vi.fn() }));
vi.mock('@/lib/exercise-pool', () => ({
  addPooledExercises: vi.fn(),
  claimPooledExercise: vi.fn(),
  countPooledExercises: vi.fn(),
}));
vi.mock('next/server', () => ({ after: vi.fn() }));

import { evaluateQuestionRound } from '@/lib/speaking/question-round';
import { withRubricScore } from '@/lib/speaking/examiner-score';
import { evaluateKETHobbyTalkAction } from '@/actions/modes/ket-speaking-part2';
import { evaluateKETPictureDescAction } from '@/actions/modes/ket-speaking-part3';
import { evaluateA2FinalAction } from '@/actions/modes/a2';
import { evaluatePETInterviewAction } from '@/actions/modes/pet-p1';
import { evaluatePETDiscussionAction } from '@/actions/modes/pet-p4';
import {
  HOBBY_PLAN_KIND,
  HobbyPlanSchema,
  PICTURE_PLAN_KIND,
  PicturePlanSchema,
  restoreKetSpeaking,
} from '@/lib/speaking/ket-speaking';

const petRubricJson = JSON.stringify({
  kind: 'formative',
  understood: true,
  highlights: ['h'],
  suggestions: ['s'],
  rubric: { task_coverage: 3, grammar: 3, vocabulary: 2, fluency: 4 },
});

const ketFeedbackJson = JSON.stringify({
  understood: true,
  highlights: ['h'],
  suggestions: ['s'],
  model_answer: null,
  rubric: { task_coverage: 4, grammar: 4, vocabulary: 4, fluency: 4 },
});

const hobbyPlan = { hobby: 'Chess', instruction: 'Talk about chess', bullet_points: ['where', 'when'], image_prompt: 'img' };

beforeEach(() => {
  vi.clearAllMocks();
  getPrompt.mockResolvedValue('PROMPT');
  openSession.mockResolvedValue({ ok: true, data: { sessionId: 's1', userId: 'u1' } });
  finishSession.mockResolvedValue({ ok: true, data: { score10: 8, messageId: 'm1' } });
  completeActivity.mockResolvedValue({ ok: true, data: { sessionId: 's9', score10: 10 } });
});

describe('withRubricScore', () => {
  it('derives score10 from the 4x4 rubric', () => {
    const feedback = withRubricScore({
      kind: 'formative',
      understood: true,
      highlights: [],
      suggestions: [],
      rubric: { task_coverage: 4, grammar: 4, vocabulary: 4, fluency: 4 },
    });
    expect(feedback.score10).toBe(10);
  });

  it('keeps feedback without a rubric ungraded', () => {
    const feedback = withRubricScore({ kind: 'formative', understood: true, highlights: [], suggestions: [] });
    expect(feedback.score10).toBeUndefined();
  });
});

describe('PET Part 1 and Part 4 grade', () => {
  it('P1 closes the session with a code-derived grade from the rubric', async () => {
    callGemini.mockResolvedValue({ ok: true, data: { text: petRubricJson } });
    const result = await evaluatePETInterviewAction([{ question: 'Q', answer: 'A' }], {
      sessionId: 's1',
      plan: {
        phase1_questions: ['q'], topicA: 'a', topicA_questions: ['q'], topicA_followup: 'f',
        topicBC: 'b', topicBC_questions: ['q'], topicBC_followup: 'f', closing: 'c',
      },
    });
    if (!result.ok) throw new Error(result.code);
    expect(result.data.feedback.score10).toBe(7.5);
    expect(finishSession.mock.calls[0][0].evaluation.score10).toBe(7.5);
  });

  it('P4 grades from the same rubric', async () => {
    callGemini.mockResolvedValue({ ok: true, data: { text: petRubricJson } });
    const result = await evaluatePETDiscussionAction([{ question: 'Q', answer: 'A' }], {
      plan: { topic: 't', link: 'l', questions: ['q'], closing: 'c' },
    });
    if (!result.ok) throw new Error(result.code);
    expect(result.data.feedback.score10).toBe(7.5);
  });

  it('an invalid evaluation does not close the session', async () => {
    callGemini.mockResolvedValue({ ok: true, data: { text: 'not json' } });
    const result = await evaluateQuestionRound(
      { mode: 'cambridge_pet_p1', promptPrefix: 'p', transcribePromptKey: 't', planCacheKey: 'k', planSchema: { safeParse: () => ({ success: true }) }, planFallback: {}, logTag: 'l', eventName: 'e' },
      [{ question: 'Q', answer: 'A' }],
      { plan: {} },
    );
    expect(result.ok).toBe(true);
    expect(finishSession).not.toHaveBeenCalled();
  });
});

describe('KET Part 1 scored evaluation', () => {
  it('scales the A2 examiner score to 0-10', async () => {
    callGemini.mockResolvedValue({
      ok: true,
      data: {
        text: JSON.stringify({
          score: 12,
          score_max: 15,
          cefr_band: 'a2',
          band_per_criterion: { grammar_and_vocabulary: 4, pronunciation: 4, interactive_communication: 4 },
          feedback: 'ok',
        }),
      },
    });
    const result = await evaluateA2FinalAction([{ question: 'Q', answer: 'A' }], {
      sessionId: 's1',
      plan: {
        phase1_questions: ['a', 'b', 'c'], topic1: 't', topic1_questions: ['1', '2', '3', '4'],
        topic2: 't', topic2_questions: ['1', '2', '3'], final_question: 'f',
      },
    });
    if (!result.ok) throw new Error(result.code);
    expect(result.data.feedback.score10).toBe(8);
  });
});

describe('KET Part 2 and Part 3 evaluation', () => {
  it('Part 2 creates the session on the first submit with plan, answer and rubric', async () => {
    callGemini.mockResolvedValue({ ok: true, data: { candidates: [{ content: { parts: [{ text: ketFeedbackJson }] } }] } });
    const result = await evaluateKETHobbyTalkAction({ plan: hobbyPlan, audioBase64: 'x', audioMime: 'audio/webm' });
    if ('error' in result) throw new Error(result.error);
    expect(result.sessionId).toBe('s9');
    const input = completeActivity.mock.calls[0][0];
    expect(input.mode).toBe('cambridge_ket_part2');
    expect(input.sessionId).toBeUndefined();
    expect(input.plan.kind).toBe(HOBBY_PLAN_KIND);
    expect(input.evaluation.rubric.fluency).toBe(4);
  });

  it('Part 3 does not close the session when the evaluation is invalid', async () => {
    callGemini.mockResolvedValue({ ok: true, data: { candidates: [{ content: { parts: [{ text: '{}' }] } }] } });
    const result = await evaluateKETPictureDescAction({
      plan: { scene_description: 's', instruction: 'i', image_prompt: 'p' },
      audioBase64: 'x',
      audioMime: 'audio/webm',
    });
    expect('error' in result).toBe(true);
    expect(completeActivity).not.toHaveBeenCalled();
  });
});

describe('restoreKetSpeaking', () => {
  it('restores plan and final feedback', () => {
    const restored = restoreKetSpeaking(
      [
        { role: 'bob', msg_type: 'text', content_json: { kind: HOBBY_PLAN_KIND, ...hobbyPlan, image_url: 'u' } },
        { role: 'user', msg_type: 'text', content_json: { kind: 'speaking_answer' } },
        {
          role: 'bob',
          msg_type: 'evaluation',
          content_json: { kind: 'hobby_talk_feedback', understood: true, highlights: ['h'], suggestions: [], model_answer: null, rubric: null, is_final: true },
        },
      ],
      HOBBY_PLAN_KIND,
      HobbyPlanSchema,
    );
    expect(restored?.plan.hobby).toBe('Chess');
    expect(restored?.plan.image_url).toBe('u');
    expect(restored?.feedback?.highlights).toEqual(['h']);
    expect(restored?.feedback?.rubric).toBeUndefined();
  });

  it('returns null without a valid plan and an open session has no feedback', () => {
    expect(restoreKetSpeaking([{ role: 'user', msg_type: 'text' }], PICTURE_PLAN_KIND, PicturePlanSchema)).toBeNull();
    const open = restoreKetSpeaking(
      [{ role: 'bob', msg_type: 'text', content_json: { kind: PICTURE_PLAN_KIND, scene_description: 's', instruction: 'i', image_prompt: 'p' } }],
      PICTURE_PLAN_KIND,
      PicturePlanSchema,
    );
    expect(open?.feedback).toBeNull();
  });
});
