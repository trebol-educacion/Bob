import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const ensureMock = vi.fn();
const recordTurnMock = vi.fn();
const finishMock = vi.fn();
const evaluationMock = vi.fn();

vi.mock('@/lib/session/lifecycle', () => ({
  ensureSession: (...a: unknown[]) => ensureMock(...a),
  recordTurn: (...a: unknown[]) => recordTurnMock(...a),
  finishSession: (...a: unknown[]) => finishMock(...a),
}));
vi.mock('@/lib/prompts/db-prompts', () => ({ getPrompt: vi.fn() }));
vi.mock('@/lib/gemini-client', () => ({ callGemini: vi.fn(), isOk: () => false }));
vi.mock('@/lib/writing/fce-evaluation', () => ({ requestFceEvaluation: (...a: unknown[]) => evaluationMock(...a) }));

import { evaluateFCEEssayAction } from '@/actions/modes/fce-writing-part1';

const NOTES = [
  { id: 1, label: 'a', description: 'da' },
  { id: 2, label: 'b', description: 'db' },
  { id: 3, label: 'Your own idea', description: 'dc' },
] as const;

const BASE = {
  understood: true,
  highlights: ['h'],
  suggestions: ['s'],
  notes_covered: [true, true, false],
  organization: 'Good',
  register: 'Good',
  model_answer: 'model',
  rubric: { task_coverage: 3, grammar: 2, vocabulary: 3, fluency: 2 },
};

const input = {
  prompt: {
    title: 'Essay',
    essayQuestion: 'q',
    context: 'c',
    notes: [...NOTES] as unknown as Parameters<typeof evaluateFCEEssayAction>[0]['prompt']['notes'],
    wordTargetMin: 140 as const,
    wordTargetMax: 190 as const,
    framingText: 'f',
  },
  userText: 'some essay text',
};

beforeEach(() => {
  ensureMock.mockReset().mockResolvedValue({ ok: true, data: { sessionId: 's1', userId: 'u1', created: true } });
  recordTurnMock.mockReset().mockResolvedValue({ ok: true, data: { ids: [] } });
  finishMock.mockReset().mockResolvedValue({ ok: true, data: { score10: 6.5, messageId: 'm' } });
  evaluationMock.mockReset();
});

describe('evaluateFCEEssayAction', () => {
  it('adds the 0-10 mark from fce_rubric, creates the session on first submit and finishes it', async () => {
    evaluationMock.mockResolvedValue({
      ...BASE,
      fce_rubric: { content: 4, communicative_achievement: 3, organisation: 3, language: 3 },
    });
    const result = await evaluateFCEEssayAction(input);
    if ('error' in result) throw new Error(result.error);
    expect(result.sessionId).toBe('s1');
    expect(result.feedback.score10).toBe(6.5);
    expect(result.feedback.notesCovered).toEqual([true, true, false]);
    expect(result.feedback.modelAnswer).toBe('model');
    const roles = recordTurnMock.mock.calls[0][0].messages.map((m: { role: string }) => m.role);
    expect(roles).toEqual(['bob', 'user']);
    expect(finishMock.mock.calls[0][0].evaluation).toMatchObject({ score: 13, score_max: 20, score_10: 6.5 });
  });

  it('shows the feedback without a mark when the rubric is incomplete', async () => {
    evaluationMock.mockResolvedValue({ ...BASE, fce_rubric: { content: 4 } });
    const result = await evaluateFCEEssayAction(input);
    if ('error' in result) throw new Error(result.error);
    expect(result.feedback.score10).toBeNull();
    expect(result.feedback.fceRubric).toBeNull();
    expect(result.feedback.highlights).toEqual(['h']);
  });

  it('keeps the submission and does not finish the session when the evaluation fails', async () => {
    evaluationMock.mockResolvedValue(null);
    const result = await evaluateFCEEssayAction(input);
    if ('error' in result) throw new Error(result.error);
    expect(result.feedback.understood).toBe(false);
    expect(result.feedback.score10).toBeNull();
    expect(recordTurnMock).toHaveBeenCalled();
    expect(finishMock).not.toHaveBeenCalled();
  });

  it('does not repeat the prompt message on an existing session', async () => {
    ensureMock.mockResolvedValue({ ok: true, data: { sessionId: 's1', userId: 'u1', created: false } });
    evaluationMock.mockResolvedValue({ ...BASE, fce_rubric: null });
    await evaluateFCEEssayAction({ ...input, sessionId: 's1' });
    expect(recordTurnMock.mock.calls[0][0].messages).toHaveLength(1);
  });
});
