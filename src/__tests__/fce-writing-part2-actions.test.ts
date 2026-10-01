import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const persistMock = vi.fn();
const readMessagesMock = vi.fn();
const createSessionMock = vi.fn();
const evaluationMock = vi.fn();
const cacheMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
  }),
}));
vi.mock('@/lib/persist-activity', () => ({
  persistMessage: (...a: unknown[]) => persistMock(...a),
  readSessionMessages: (...a: unknown[]) => readMessagesMock(...a),
}));
vi.mock('@/actions/sessions', () => ({ createSessionAction: (...a: unknown[]) => createSessionMock(...a) }));
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
  persistMock.mockReset().mockResolvedValue({ id: 'msg' });
  readMessagesMock.mockReset().mockResolvedValue([PLAN_MESSAGE]);
  createSessionMock.mockReset().mockResolvedValue({ data: { id: 's1', user_id: 'user-1' }, error: null });
  evaluationMock.mockReset().mockResolvedValue(EVALUATION);
  cacheMock.mockReset().mockResolvedValue(GENERATION);
});

describe('startFCEWritingPart2Action', () => {
  it('returns three tasks from the cache pool and persists the plan', async () => {
    const result = await startFCEWritingPart2Action();
    if ('error' in result) throw new Error(result.error);
    expect(result.tasks).toHaveLength(3);
    expect(result.tasks.map((task) => task.taskType)).toEqual(['article', 'report', 'email_letter']);
    expect(createSessionMock).toHaveBeenCalledWith(expect.objectContaining({ mode: 'cambridge_fce_writing_part2' }));
    expect(cacheMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'plan', promptKey: 'cambridge_fce_writing_part2_b2_generation' }),
      expect.any(Function),
      expect.any(Object),
    );
    expect(persistMock).toHaveBeenCalledWith(
      expect.objectContaining({ contentJson: expect.objectContaining({ kind: 'writing_tasks' }) }),
    );
  });

  it('returns an error when the generation fails', async () => {
    cacheMock.mockResolvedValue({ error: 'x' });
    const result = await startFCEWritingPart2Action();
    expect('error' in result).toBe(true);
  });
});

describe('submitFCEWritingPart2Action', () => {
  it('evaluates the chosen task, computes the mark in code and persists a final evaluation', async () => {
    const result = await submitFCEWritingPart2Action({ sessionId: 's1', taskNumber: 3, text: 'one two three' });
    if ('error' in result) throw new Error(result.error);
    expect(result.score_10).toBe(6.5);
    expect(result.fce_rubric).toEqual(RUBRIC);
    expect(result.indicators).toEqual({ word_count: 3, target_word_count_range: [140, 190] });
    expect(evaluationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({ TASK_TYPE: 'report', TASK_TEXT: 'Write a report on the school library.' }),
      }),
    );
    const evaluationCall = persistMock.mock.calls.find(([arg]) => arg.msgType === 'evaluation');
    expect(evaluationCall?.[0].contentJson).toMatchObject({
      is_final: true,
      score: 13,
      score_max: 20,
      score_10: 6.5,
      task_number: 3,
    });
    const submission = persistMock.mock.calls.find(([arg]) => arg.role === 'user');
    expect(submission?.[0].contentJson).toMatchObject({ kind: 'writing_submission', task_number: 3 });
  });

  it('does not persist anything when the model output lacks a valid rubric', async () => {
    evaluationMock.mockResolvedValue(null);
    const result = await submitFCEWritingPart2Action({ sessionId: 's1', taskNumber: 2, text: 'text' });
    expect(result).toEqual({ error: expect.any(String) });
    expect(persistMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown task and a foreign or missing session', async () => {
    expect(await submitFCEWritingPart2Action({ sessionId: 's1', taskNumber: 9, text: 't' })).toEqual({
      error: 'Unknown task',
    });
    readMessagesMock.mockResolvedValue([]);
    expect(await submitFCEWritingPart2Action({ sessionId: 'other', taskNumber: 2, text: 't' })).toEqual({
      error: 'Session not found',
    });
    expect(evaluationMock).not.toHaveBeenCalled();
  });

  it('rejects a second submission once a final evaluation exists', async () => {
    readMessagesMock.mockResolvedValue([
      PLAN_MESSAGE,
      { ...PLAN_MESSAGE, id: 'm2', msg_type: 'evaluation', content_json: { is_final: true } },
    ]);
    expect(await submitFCEWritingPart2Action({ sessionId: 's1', taskNumber: 2, text: 't' })).toEqual({
      error: 'Already submitted',
    });
    expect(evaluationMock).not.toHaveBeenCalled();
  });
});
