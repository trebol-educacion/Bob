import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const completeMock = vi.fn();
const createSessionMock = vi.fn();
const geminiMock = vi.fn();
const promptMock = vi.fn();
const pickContent = vi.fn();

vi.mock('@/lib/session/complete', () => ({ completeActivity: (...a: unknown[]) => completeMock(...a) }));
vi.mock('@/lib/session/lifecycle', () => ({ currentUserId: async () => 'u1' }));
vi.mock('@/actions/sessions', () => ({ createSessionAction: (...a: unknown[]) => createSessionMock(...a) }));
vi.mock('@/lib/prompts/db-prompts', () => ({ getPrompt: (...a: unknown[]) => promptMock(...a) }));
vi.mock('@/lib/item-bank/content-source', () => ({ pickContent: (...a: unknown[]) => pickContent(...a) }));
vi.mock('@/lib/gemini-client', () => ({
  callGemini: (...a: unknown[]) => geminiMock(...a),
  isOk: (r: { ok?: boolean }) => r.ok === true,
}));

import { generatePETShortTextsAction, submitPETShortTextsAnswersAction } from '@/actions/modes/pet-reading-part1';
import {
  generatePETReadingComprehensionAction,
  submitPETReadingComprehensionAction,
} from '@/actions/modes/pet-reading-comprehension';
import { generatePETEmailAction, evaluatePETEmailAction } from '@/actions/modes/pet-writing-part1';
import {
  generatePETWritingChallengeAction,
  submitPETWritingChallengeAction,
} from '@/actions/modes/pet-writing-challenge';
import { tryRestore as restoreShortTexts } from '@/components/practice/pet/PETShortTextsPractice';
import { tryRestore as restoreComprehension } from '@/components/practice/pet/PETReadingComprehensionPractice';
import { tryRestoreFromMessages as restoreEmail } from '@/components/practice/pet/PETEmailWritingPractice';
import { tryRestoreFromMessages as restoreChallenge } from '@/components/practice/pet/PETWritingChallengePractice';
import type { StoredMessage } from '@/actions/messages';

function banked(plan: unknown) {
  return { ok: true, data: { kind: 'group', group: { id: 'g1', metadata: { plan } }, items: [] } };
}

function geminiJson(payload: unknown) {
  return { ok: true, data: { candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] } };
}

function stored(role: 'bob' | 'user', msgType: string, json: Record<string, unknown>): StoredMessage {
  return { id: 'm', session_id: 's1', user_id: 'u1', role, msg_type: msgType, content_text: null, content_json: json, created_at: '' } as unknown as StoredMessage;
}

function completionMessages(): StoredMessage[] {
  const call = completeMock.mock.calls[0][0];
  return [
    stored('bob', 'text', call.plan),
    ...call.answers.map((a: Record<string, unknown>) => stored('user', 'text', a)),
    stored('bob', 'evaluation', { ...call.evaluation, is_final: true }),
  ];
}

beforeEach(() => {
  completeMock.mockReset().mockResolvedValue({ ok: true, data: { sessionId: 's1', score10: 8 } });
  createSessionMock.mockReset();
  geminiMock.mockReset();
  pickContent.mockReset();
  promptMock.mockReset().mockResolvedValue('prompt');
});

const SHORT_ITEMS = Array.from({ length: 5 }, (_, i) => ({
  number: i + 1,
  text_body: 'body',
  text_context: 'ctx',
  question: 'q',
  options: [
    { id: 'A', text: 'a' },
    { id: 'B', text: 'b' },
    { id: 'C', text: 'c' },
  ],
  correct_option: 'B',
  explanation: 'e',
}));

describe('PET Reading Part 1', () => {
  it('generates without creating a session or persisting', async () => {
    pickContent.mockResolvedValue(banked({ items: SHORT_ITEMS }));
    const result = await generatePETShortTextsAction();
    expect(result).toMatchObject({ ok: true, data: { items: [{ bank_group_id: 'g1' }, {}, {}, {}, {}] } });
    expect(geminiMock).not.toHaveBeenCalled();
    expect(createSessionMock).not.toHaveBeenCalled();
    expect(completeMock).not.toHaveBeenCalled();
  });

  it('closes through completeActivity and the stored plan restores with its result', async () => {
    const items = SHORT_ITEMS as unknown as Parameters<typeof submitPETShortTextsAnswersAction>[0]['items'];
    const result = await submitPETShortTextsAnswersAction({
      framingText: 'f',
      answers: { 1: 'B', 2: 'B', 3: 'A', 4: 'B', 5: 'B' },
      items,
    });
    if ('error' in result) throw new Error(result.error);
    expect(completeMock).toHaveBeenCalledTimes(1);
    expect(completeMock.mock.calls[0][0].mode).toBe('cambridge_pet_reading_part1');
    expect(completeMock.mock.calls[0][0].evaluation).toMatchObject({ score: 4, score_max: 5 });
    const restored = restoreShortTexts(completionMessages());
    expect(restored?.items).toHaveLength(5);
    expect(restored?.correctCount).toBe(4);
    expect(restored?.results).toHaveLength(5);
  });

  it('returns no_content with an empty bank without calling Gemini', async () => {
    pickContent.mockResolvedValue({ ok: false, code: 'no_content', retryable: false });
    expect(await generatePETShortTextsAction()).toMatchObject({ ok: false, code: 'no_content' });
    expect(geminiMock).not.toHaveBeenCalled();
  });

  it('reports a failed completion instead of pretending success', async () => {
    completeMock.mockResolvedValue({ ok: false, code: 'persist_failed', retryable: true });
    const result = await submitPETShortTextsAnswersAction({
      framingText: 'f',
      answers: {},
      items: SHORT_ITEMS as unknown as Parameters<typeof submitPETShortTextsAnswersAction>[0]['items'],
    });
    expect(result).toEqual({ error: 'persist_failed' });
  });
});

const SECTION_BY_INDEX = ['comprehension', 'comprehension', 'comprehension', 'comprehension', 'vocabulary', 'vocabulary', 'vocabulary', 'grammar', 'grammar', 'grammar'];

const COMPREHENSION = {
  title: 't',
  topics: ['x'],
  text: 'text',
  questions: SECTION_BY_INDEX.map((section, i) =>
    i === 9
      ? { number: 10, section, type: 'open', question: 'q', accept: ['dog'], feedback: 'f' }
      : { number: i + 1, section, type: 'mcq', question: 'q', options: { A: 'a', B: 'b', C: 'c' }, answer: 'A', feedback: { A: 'f', B: 'f', C: 'f' } },
  ),
};

const COMPREHENSION_ANSWERS = {
  ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, { type: 'mcq', value: 'A' }])),
  10: { type: 'open', value: 'Dog.' },
} as Record<number, { type: 'mcq'; value: 'A' } | { type: 'open'; value: string }>;

describe('PET Reading comprehension', () => {
  it('seals the answer key, scores server-side and restores', async () => {
    pickContent.mockResolvedValue(banked(COMPREHENSION));
    const generatedResult = await generatePETReadingComprehensionAction();
    if (!generatedResult.ok) throw new Error(generatedResult.code);
    const generated = generatedResult.data;
    expect(geminiMock).not.toHaveBeenCalled();
    expect(JSON.stringify(generated)).not.toContain('"answer"');
    expect(createSessionMock).not.toHaveBeenCalled();

    const result = await submitPETReadingComprehensionAction({
      planToken: generated.planToken,
      answers: COMPREHENSION_ANSWERS,
    });
    if ('error' in result) throw new Error(result.error);
    expect(result.correct_count).toBe(10);
    expect(completeMock.mock.calls[0][0].mode).toBe('cambridge_pet_reading_comprehension');
    expect(completeMock.mock.calls[0][0].bank).toEqual({ exam_part: 'pet_reading_comprehension', bank_group_id: 'g1' });
    const restored = restoreComprehension(completionMessages());
    expect(restored?.questions).toHaveLength(10);
    expect(restored?.correctCount).toBe(10);
  });

  it('rejects a forged token', async () => {
    const result = await submitPETReadingComprehensionAction({ planToken: 'forged', answers: {} });
    expect(result).toEqual({ error: 'Could not load exercise' });
    expect(completeMock).not.toHaveBeenCalled();
  });
});

describe('PET Writing Part 1', () => {
  const prompt = {
    emailReceived: { from: 'a', subject: 's', body: 'b' },
    contentPoints: ['1', '2', '3', '4'] as [string, string, string, string],
    wordTarget: 100,
    context: 'c',
    framingText: 'f',
  };

  it('generate does not persist', async () => {
    pickContent.mockResolvedValue(
      banked({ email_received: prompt.emailReceived, content_points: prompt.contentPoints, word_target: 100, context: 'c' }),
    );
    const result = await generatePETEmailAction();
    expect(result).toMatchObject({ ok: true, data: { bankGroupId: 'g1', wordTarget: 100 } });
    expect(geminiMock).not.toHaveBeenCalled();
    expect(createSessionMock).not.toHaveBeenCalled();
    expect(completeMock).not.toHaveBeenCalled();
  });

  it('does not close when the evaluation fails', async () => {
    geminiMock.mockResolvedValue({ ok: false });
    const result = await evaluatePETEmailAction({ ...prompt, userText: 'hello' });
    expect(result).toEqual({ error: 'evaluation_failed' });
    expect(completeMock).not.toHaveBeenCalled();
  });

  it('closes with the rubric grade and restores', async () => {
    geminiMock.mockResolvedValue(
      geminiJson({
        understood: true,
        highlights: ['h'],
        suggestions: ['s'],
        content_points_covered: [true, true, false, true],
        model_answer: 'm',
        rubric: { task_coverage: 4, grammar: 3, vocabulary: 3, fluency: 2 },
      }),
    );
    const result = await evaluatePETEmailAction({ ...prompt, userText: 'hello' });
    if ('error' in result) throw new Error(result.error);
    expect(result.sessionId).toBe('s1');
    const call = completeMock.mock.calls[0][0];
    expect(call.mode).toBe('cambridge_pet_writing_part1');
    expect(call.evaluation.rubric).toEqual({ task_coverage: 4, grammar: 3, vocabulary: 3, fluency: 2 });
    const restored = restoreEmail(completionMessages());
    expect(restored.prompt?.wordTarget).toBe(100);
    expect(restored.userText).toBe('hello');
    expect(restored.feedback?.contentPointsCovered).toEqual([true, true, false, true]);
  });
});

describe('PET Writing Challenge', () => {
  const prompt = {
    format: 'email' as const,
    title: 't',
    theme: 'th',
    stimulus: 'st',
    task: 'task',
    guidePoints: ['a', 'b', 'c'],
    minWords: 60,
    maxWords: 100,
    framingText: 'f',
  };

  it('generate does not persist', async () => {
    pickContent.mockResolvedValue(
      banked({ format: 'email', title: 't', theme: 'th', stimulus: 'st', task: 'task', guide_points: ['a', 'b', 'c'], min_words: 60, max_words: 100 }),
    );
    const result = await generatePETWritingChallengeAction();
    expect(result).toMatchObject({ ok: true, data: { bankGroupId: 'g1', title: 't' } });
    expect(geminiMock).not.toHaveBeenCalled();
    expect(createSessionMock).not.toHaveBeenCalled();
    expect(completeMock).not.toHaveBeenCalled();
  });

  it('closes formative feedback without a grade and restores', async () => {
    geminiMock.mockResolvedValue(geminiJson({ motivation: 'good', vocabulary: [], grammar: [] }));
    const result = await submitPETWritingChallengeAction({ prompt, userText: 'my text' });
    if ('error' in result) throw new Error(result.error);
    expect(completeMock.mock.calls[0][0].mode).toBe('cambridge_pet_writing_challenge');
    const restored = restoreChallenge(completionMessages());
    expect(restored.prompt?.task).toBe('task');
    expect(restored.userText).toBe('my text');
    expect(restored.feedback?.kind).toBe('formative');
  });

  it('does not close when the evaluation fails', async () => {
    geminiMock.mockResolvedValue({ ok: false });
    const result = await submitPETWritingChallengeAction({ prompt, userText: 'my text' });
    expect(result).toEqual({ error: 'evaluation_failed' });
    expect(completeMock).not.toHaveBeenCalled();
  });
});
