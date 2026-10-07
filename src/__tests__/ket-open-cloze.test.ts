import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gradeOpenCloze, normalizeWord } from '@/lib/ket/open-cloze-grading';
import { toPublicOpenCloze, type KetOpenClozePlan } from '@/lib/bank-plans/ket-reading-part5';

vi.mock('server-only', () => ({}));

const completeMock = vi.fn();
const loadPlanMock = vi.fn();

vi.mock('@/lib/session/complete', () => ({ completeActivity: (...a: unknown[]) => completeMock(...a) }));
vi.mock('@/lib/session/lifecycle', () => ({ currentUserId: async () => 'user-1' }));
vi.mock('@/lib/prompts/db-prompts', () => ({ getPrompt: vi.fn(async () => 'framing') }));
vi.mock('@/lib/item-bank/plan-bank', async (original) => ({
  ...(await original<typeof import('@/lib/item-bank/plan-bank')>()),
  loadPlan: (...a: unknown[]) => loadPlanMock(...a),
}));

import { submitKETOpenClozeAction } from '@/actions/modes/ket-reading-part5';

const PLAN: KetOpenClozePlan = {
  title: 'Our club',
  text: 'We meet ___1___ Mondays. ___2___ is fun. Come ___3___ us. It ___4___ free. Bring ___5___ friend. See ___6___ soon.',
  gaps: [
    { number: 1, answer: 'on', accepted: [] },
    { number: 2, answer: 'It', accepted: ['This'] },
    { number: 3, answer: 'with', accepted: [] },
    { number: 4, answer: 'is', accepted: [] },
    { number: 5, answer: 'a', accepted: ['your'] },
    { number: 6, answer: 'you', accepted: [] },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  loadPlanMock.mockResolvedValue({ ok: true, data: PLAN });
  completeMock.mockResolvedValue({ ok: true, data: { sessionId: 's-1' } });
});

describe('open cloze grading', () => {
  it('normalizes case, spaces and punctuation', () => {
    expect(normalizeWord('  On. ')).toBe('on');
  });

  it('accepts the key and its variants and rejects blanks', () => {
    const results = gradeOpenCloze(PLAN, { 1: 'ON', 2: 'this', 3: 'to', 5: 'your' });
    expect(results.map((r) => r.is_correct)).toEqual([true, true, false, false, true, false]);
    expect(results[2]).toMatchObject({ given: 'to', expected: 'with' });
  });

  it('the public plan carries no answers', () => {
    expect(JSON.stringify(toPublicOpenCloze(PLAN))).not.toContain('accepted');
    expect(toPublicOpenCloze(PLAN).gap_numbers).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('submitKETOpenClozeAction', () => {
  const exercise = { ...toPublicOpenCloze(PLAN), bank_group_id: 'g-1' };

  it('grades with the bank keys and closes the session once', async () => {
    const result = await submitKETOpenClozeAction({ framing_text: 'f', exercise, answers: { 1: 'on', 2: 'it' } });
    expect(loadPlanMock).toHaveBeenCalledWith('g-1', expect.anything());
    expect(result).toMatchObject({ ok: true, data: { sessionId: 's-1', correct_count: 2, total: 6 } });
    const call = completeMock.mock.calls[0][0];
    expect(call.mode).toBe('cambridge_ket_reading_part5');
    expect(call.evaluation).toMatchObject({ score: 2, score_max: 6, is_final: true });
    expect(call.plan.exercise).not.toHaveProperty('gaps');
  });

  it('fails without closing the session when the plan is gone', async () => {
    loadPlanMock.mockResolvedValue({ ok: false, code: 'no_content', retryable: false });
    const result = await submitKETOpenClozeAction({ framing_text: 'f', exercise, answers: {} });
    expect(result).toMatchObject({ ok: false, code: 'no_content' });
    expect(completeMock).not.toHaveBeenCalled();
  });
});
