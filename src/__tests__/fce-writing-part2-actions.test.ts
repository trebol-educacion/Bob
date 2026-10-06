import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const recordTurnMock = vi.fn();
const finishMock = vi.fn();
const ensureMock = vi.fn();
const readMessagesMock = vi.fn();
const evaluationMock = vi.fn();
const cacheMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
  }),
}));
vi.mock('@/lib/persist-activity', () => ({
  readSessionMessages: (...a: unknown[]) => readMessagesMock(...a),
}));
vi.mock('@/lib/session/lifecycle', () => ({
  ensureSession: (...a: unknown[]) => ensureMock(...a),
  recordTurn: (...a: unknown[]) => recordTurnMock(...a),
  finishSession: (...a: unknown[]) => finishMock(...a),
}));
vi.mock('@/lib/prompts/db-prompts', () => ({ getPrompt: async () => 'prompt' }));
vi.mock('@/lib/gemini-client', () => ({ callGemini: vi.fn(), isOk: () => false }));
vi.mock('@/lib/cache', () => ({ getOrCreateCachedContent: (...a: unknown[]) => cacheMock(...a) }));
vi.mock('@/lib/writing/fce-evaluation', () => ({ requestFceEvaluation: (...a: unknown[]) => evaluationMock(...a) }));

import { startFCEWritingPart2Action, submitFCEWritingPart2Action } from '@/actions/modes/fce-writing-part2';

const GENERATION = {
  title: 'B2 First Writing - Part 2 (Choice Task)',
  instructions: 'Write an answer to one of the questions (2, 3, or 4).',
  tasks: [
    { number: 2, task_type: 'article', situation: 'Write an article about hobbies.', register: 'semi-formal' },
    { number: 3, task_type: 'report', situation: 'Write a report on the school library.', register: 'formal' },
    { number: 4, task_type: 'email_letter', situation: 'Write to the council about a bus stop.', register: 'formal' },
  ],
};

const PLAN = {
  title: GENERATION.title,
  instructions: GENERATION.instructions,
  framingText: 'Framing',
  tasks: GENERATION.tasks.map((t) => ({ number: t.number, taskType: t.task_type as 'article', situation: t.situation, register: t.register })),
};

const PLAN_MESSAGE = {
  id: 'm1',
  role: 'bob',
  msg_type: 'text',
  content_text: null,
  content_json: { kind: 'writing_tasks', ...GENERATION, framing_text: 'Framing' },
  created_at: '',
};

const RUBRIC = { content: 4, communicative_achievement: 3, organisation: 3, language: 3 };
const EVALUATION = {
  understood: true,
  register_ok: true,
  highlights: ['Nice opening'],
  suggestions: ['Link ideas'],
  model_answer: 'Model text',
  fce_rubric: RUBRIC,
};

beforeEach(() => {
  recordTurnMock.mockReset().mockResolvedValue({ ok: true, data: { ids: [] } });
  finishMock.mockReset().mockResolvedValue({ ok: true, data: { score10: 6.5, messageId: 'm' } });
  ensureMock.mockReset().mockResolvedValue({ ok: true, data: { sessionId: 's1', userId: 'user-1', created: true } });
  readMessagesMock.mockReset().mockResolvedValue([PLAN_MESSAGE]);
  evaluationMock.mockReset().mockResolvedValue(EVALUATION);
  cacheMock.mockReset().mockResolvedValue(GENERATION);
});

describe('startFCEWritingPart2Action', () => {
  it('returns three tasks from the cache pool without creating a session', async () => {
    const result = await startFCEWritingPart2Action();
    if ('error' in result) throw new Error(result.error);
    expect(result.tasks).toHaveLength(3);
    expect(result.tasks.map((task) => task.taskType)).toEqual(['article', 'report', 'email_letter']);
    expect(ensureMock).not.toHaveBeenCalled();
    expect(cacheMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'plan', promptKey: 'cambridge_fce_writing_part2_b2_generation' }),
      expect.any(Function),
      expect.any(Object),
    );
  });

  it('returns an error when the generation fails', async () => {
    cacheMock.mockResolvedValue({ error: 'x' });
    const result = await startFCEWritingPart2Action();
    expect('error' in result).toBe(true);
  });
});

describe('submitFCEWritingPart2Action', () => {
  it('evaluates the chosen task, creates the session on first submit and finishes it with the mark', async () => {
    const result = await submitFCEWritingPart2Action({ plan: PLAN, taskNumber: 3, text: 'one two three' });
    if ('error' in result) throw new Error(result.error);
    expect(result.sessionId).toBe('s1');
    expect(result.feedback.score_10).toBe(6.5);
    expect(result.feedback.fce_rubric).toEqual(RUBRIC);
    expect(result.feedback.indicators).toEqual({ word_count: 3, target_word_count_range: [140, 190] });
    expect(evaluationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({ TASK_TYPE: 'report', TASK_TEXT: 'Write a report on the school library.' }),
      }),
    );
    const messages = recordTurnMock.mock.calls[0][0].messages;
    expect(messages[0].contentJson).toMatchObject({ kind: 'writing_tasks' });
    expect(messages[1].contentJson).toMatchObject({ kind: 'writing_submission', task_number: 3 });
    expect(finishMock.mock.calls[0][0].evaluation).toMatchObject({ score: 13, score_max: 20, score_10: 6.5, task_number: 3 });
  });

  it('does not create a session when the model output lacks a valid rubric', async () => {
    evaluationMock.mockResolvedValue(null);
    const result = await submitFCEWritingPart2Action({ plan: PLAN, taskNumber: 2, text: 'text' });
    expect(result).toEqual({ error: expect.any(String) });
    expect(ensureMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown task', async () => {
    expect(await submitFCEWritingPart2Action({ plan: PLAN, taskNumber: 9, text: 't' })).toEqual({ error: 'Unknown task' });
    expect(evaluationMock).not.toHaveBeenCalled();
  });

  it('rejects a second submission once a final evaluation exists', async () => {
    readMessagesMock.mockResolvedValue([
      PLAN_MESSAGE,
      { ...PLAN_MESSAGE, id: 'm2', msg_type: 'evaluation', content_json: { is_final: true } },
    ]);
    expect(await submitFCEWritingPart2Action({ sessionId: 's1', plan: PLAN, taskNumber: 2, text: 't' })).toEqual({
      error: 'Already submitted',
    });
    expect(evaluationMock).not.toHaveBeenCalled();
  });
});
