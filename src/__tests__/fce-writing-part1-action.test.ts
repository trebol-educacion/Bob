import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const persistMock = vi.fn();
const evaluationMock = vi.fn();

vi.mock('@/lib/persist-activity', () => ({ persistMessage: (...a: unknown[]) => persistMock(...a) }));
vi.mock('@/actions/sessions', () => ({ createSessionAction: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServer: vi.fn() }));
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
  sessionId: 's1',
  userId: 'u1',
  title: 'Essay',
  notes: [...NOTES] as unknown as Parameters<typeof evaluateFCEEssayAction>[0]['notes'],
  userText: 'some essay text',
};

beforeEach(() => {
  persistMock.mockReset().mockResolvedValue({ id: 'm' });
  evaluationMock.mockReset();
});

describe('evaluateFCEEssayAction', () => {
  it('adds the 0-10 mark from fce_rubric and keeps the formative fields', async () => {
    evaluationMock.mockResolvedValue({
      ...BASE,
      fce_rubric: { content: 4, communicative_achievement: 3, organisation: 3, language: 3 },
    });
    const result = await evaluateFCEEssayAction(input);
    if ('error' in result) throw new Error(result.error);
    expect(result.score10).toBe(6.5);
    expect(result.notesCovered).toEqual([true, true, false]);
    expect(result.modelAnswer).toBe('model');
    const finalCall = persistMock.mock.calls.find(([arg]) => arg.msgType === 'evaluation');
    expect(finalCall?.[0].contentJson).toMatchObject({ is_final: true, score: 13, score_max: 20, score_10: 6.5 });
  });

  it('shows the feedback without a mark when the rubric is incomplete', async () => {
    evaluationMock.mockResolvedValue({ ...BASE, fce_rubric: { content: 4 } });
    const result = await evaluateFCEEssayAction(input);
    if ('error' in result) throw new Error(result.error);
    expect(result.score10).toBeNull();
    expect(result.fceRubric).toBeNull();
    expect(result.highlights).toEqual(['h']);
  });

  it('returns the fallback feedback when the evaluation fails', async () => {
    evaluationMock.mockResolvedValue(null);
    const result = await evaluateFCEEssayAction(input);
    if ('error' in result) throw new Error(result.error);
    expect(result.understood).toBe(false);
    expect(result.score10).toBeNull();
    expect(persistMock.mock.calls[0][0].contentJson).toMatchObject({ is_final: true });
  });
});
