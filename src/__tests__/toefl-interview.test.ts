import { describe, it, expect, vi, beforeEach } from 'vitest';

const openMock = vi.fn();
const recordMock = vi.fn();
const finishMock = vi.fn();
const geminiMock = vi.fn();
const readMock = vi.fn();
vi.mock('@/lib/session/lifecycle', () => ({
  currentUserId: async () => 'u1',
  openSession: (...a: unknown[]) => openMock(...a),
  recordTurn: (...a: unknown[]) => recordMock(...a),
  finishSession: (...a: unknown[]) => finishMock(...a),
}));
vi.mock('@/lib/persist-activity', () => ({ readSessionMessages: (...a: unknown[]) => readMock(...a) }));
vi.mock('@/lib/gemini-client', () => ({ callGemini: (...a: unknown[]) => geminiMock(...a) }));
vi.mock('@/lib/prompts/db-prompts', () => ({ getPrompt: async () => 'p' }));
vi.mock('@/lib/cache', () => ({ getOrCreateCachedContent: vi.fn() }));

import { finishToeflInterviewAction, submitToeflAnswerAction } from '@/actions/modes/toefl_interview';
import { averageRubric, buildInterviewEvaluation, restoreInterview } from '@/lib/toefl/interview';

const plan = {
  topic_id: 't',
  topic_name: 'Topic',
  topic_context: 'ctx',
  questions: [1, 2, 3, 4].map((n) => ({ text: `q${n}`, difficulty: n, suggested_time: 45 })),
};

const feedback = (value: number) => ({
  kind: 'formative' as const,
  understood: true,
  highlights: ['h'],
  suggestions: ['s'],
  rubric: { task_coverage: value, grammar: value, vocabulary: value, fluency: value },
});

beforeEach(() => {
  openMock.mockReset().mockResolvedValue({ ok: true, data: { sessionId: 's1', userId: 'u1' } });
  recordMock.mockReset().mockResolvedValue({ ok: true, data: { ids: [] } });
  finishMock.mockReset().mockResolvedValue({ ok: true, data: { score10: 7.5, messageId: 'm' } });
  geminiMock.mockReset();
  readMock.mockReset();
});

describe('interview rubric', () => {
  it('averages each criterion over the graded answers', () => {
    expect(averageRubric([feedback(4), feedback(2)])).toEqual({ task_coverage: 3, grammar: 3, vocabulary: 3, fluency: 3 });
    expect(averageRubric([{ kind: 'formative', understood: false, highlights: [], suggestions: [] }])).toBeNull();
  });

  it('builds an evaluation only when something is graded', () => {
    expect(buildInterviewEvaluation([])).toBeNull();
    expect(buildInterviewEvaluation([feedback(3)])).toMatchObject({ summary: true, questionsAnswered: 1, rubric: { grammar: 3 } });
  });
});

describe('restoreInterview', () => {
  it('rebuilds plan, ordered answers and the finished flag', () => {
    const restored = restoreInterview([
      { role: 'bob', msg_type: 'phrase', content_json: plan },
      { role: 'bob', msg_type: 'evaluation', content_json: { questionIndex: 1, ...feedback(2) } },
      { role: 'bob', msg_type: 'evaluation', content_json: { questionIndex: 0, ...feedback(4) } },
      { role: 'bob', msg_type: 'evaluation', content_json: { summary: true, is_final: true } },
    ]);
    expect(restored?.plan.topic_id).toBe('t');
    expect(restored?.evaluations.map((e) => e.rubric?.grammar)).toEqual([4, 2]);
    expect(restored?.finished).toBe(true);
  });

  it('returns null without a plan', () => {
    expect(restoreInterview([{ role: 'bob', msg_type: 'evaluation', content_json: {} }])).toBeNull();
  });
});

describe('submitToeflAnswerAction', () => {
  const input = { plan, questionIndex: 0, audioBase64: 'x', mimeType: 'audio/webm', durationMs: 1000 };

  it('opens the session with the plan and records the graded answer', async () => {
    geminiMock.mockResolvedValue({ ok: true, data: { text: JSON.stringify(feedback(3)) } });
    const outcome = await submitToeflAnswerAction(input);
    expect(openMock).toHaveBeenCalledWith(expect.objectContaining({ mode: 'toefl_interview', topic: 't' }));
    expect(recordMock).toHaveBeenCalled();
    expect(outcome).toMatchObject({ sessionId: 's1' });
  });

  it('creates no session when the evaluation fails or has no rubric', async () => {
    geminiMock.mockResolvedValue({ ok: false, error: 'x' });
    expect(await submitToeflAnswerAction(input)).toEqual({ error: 'evaluation_failed' });
    geminiMock.mockResolvedValue({ ok: true, data: { text: JSON.stringify({ kind: 'formative', understood: true, highlights: [], suggestions: [] }) } });
    expect(await submitToeflAnswerAction(input)).toEqual({ error: 'evaluation_failed' });
    expect(openMock).not.toHaveBeenCalled();
  });
});

describe('finishToeflInterviewAction', () => {
  it('closes the session with the averaged rubric', async () => {
    readMock.mockResolvedValue([
      { role: 'bob', msg_type: 'phrase', content_json: plan },
      { role: 'bob', msg_type: 'evaluation', content_json: { questionIndex: 0, ...feedback(4) } },
    ]);
    expect(await finishToeflInterviewAction('s1')).toEqual({ score10: 7.5 });
    expect(finishMock).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 's1', evaluation: expect.objectContaining({ rubric: expect.objectContaining({ grammar: 4 }) }) }),
    );
  });

  it('does not close a session without graded answers', async () => {
    readMock.mockResolvedValue([{ role: 'bob', msg_type: 'phrase', content_json: plan }]);
    expect(await finishToeflInterviewAction('s1')).toEqual({ error: 'nothing_to_grade' });
    expect(finishMock).not.toHaveBeenCalled();
  });
});
