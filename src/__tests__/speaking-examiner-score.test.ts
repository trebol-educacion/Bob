import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/gemini-client', () => ({ callGemini: vi.fn(), safeParseFallback: vi.fn() }));
vi.mock('@/lib/prompts/db-prompts', () => ({ getPrompt: vi.fn() }));
vi.mock('@/lib/persist-activity', () => ({ persistMessage: vi.fn(), readSessionMessagesForCurrentOrUser: vi.fn() }));
vi.mock('@/lib/cache', () => ({ getOrCreateCachedContent: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServer: vi.fn() }));

import { toExaminerFeedback } from '@/lib/speaking/examiner-score';
import { FCE_COLLABORATIVE_CONFIG } from '@/lib/speaking/fce-configs';

const bands = {
  grammar_and_vocabulary: 4,
  pronunciation: 3,
  interactive_communication: 5,
  discourse_management: 4,
};

describe('toExaminerFeedback', () => {
  it('derives the 0-10 grade from the four criteria, ignoring the model total', () => {
    const feedback = toExaminerFeedback({
      score: 20,
      score_max: 20,
      cefr_band: 'B2',
      band_per_criterion: bands,
      feedback: 'Good range.',
      model_answer: 'I would say that',
    });
    expect(feedback?.score).toBe(16);
    expect(feedback?.score_max).toBe(20);
    expect(feedback?.score10).toBe(8);
    expect(feedback?.cefr_band).toBe('b2');
    expect(feedback?.feedback).toBe('Good range.');
    expect(feedback?.highlights).toContain('Interactive communication: 5/5');
    expect(feedback?.suggestions).toEqual(['Keep working on pronunciation (3/5)']);
  });

  it('scales the model score when criteria are missing', () => {
    const feedback = toExaminerFeedback({ score: 30, score_max: 40, cefr_band: 'b2', feedback: 'ok' });
    expect(feedback?.score).toBe(15);
    expect(feedback?.score10).toBe(7.5);
  });

  it('rounds fractional criteria and rejects out-of-range ones', () => {
    const rounded = toExaminerFeedback({
      score: 0,
      score_max: 20,
      cefr_band: 'b2',
      band_per_criterion: { ...bands, pronunciation: 3.6 },
      feedback: 'ok',
    });
    expect(rounded?.band_per_criterion?.pronunciation).toBe(4);
    expect(
      toExaminerFeedback({ score: 0, score_max: 20, cefr_band: 'b2', band_per_criterion: { ...bands, pronunciation: 9 }, feedback: 'ok' }),
    ).toBeNull();
  });

  it('returns null for an invalid shape', () => {
    expect(toExaminerFeedback({ nope: true })).toBeNull();
  });
});

describe('FCE collaborative configuration', () => {
  it('maps the examiner JSON to the shared scenario shape', () => {
    const parsed = FCE_COLLABORATIVE_CONFIG.scenarioSchema?.safeParse({
      topic: 'T',
      prompts: ['a', 'b', 'c', 'd', 'e'],
      examiner_script: 'script',
      decision_question: 'decide?',
    });
    expect(parsed?.success).toBe(true);
    expect(parsed?.data).toEqual({ topic: 'T', situation: 'script', prompt_question: 'decide?', options: ['a', 'b', 'c', 'd', 'e'] });
  });

  it('numbers the candidate turn for the template variables', () => {
    const variables = FCE_COLLABORATIVE_CONFIG.templateVariables?.({
      scenario: { topic: 'T', situation: 's', prompt_question: 'q', options: ['a', 'b', 'c', 'd', 'e'] },
      history: [{ role: 'examiner', text: 'hi' }, { role: 'user', text: 'x' }, { role: 'examiner', text: 'y' }],
      userTurn: 'z',
    });
    expect(variables?.TURN_INDEX).toBe('2');
    expect(variables?.TOPIC).toBe('T');
    expect(variables?.USER_TURN).toBe('z');
  });
});
