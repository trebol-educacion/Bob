import { describe, it, expect, vi, beforeEach } from 'vitest';

const completeMock = vi.fn();
const loadPlanMock = vi.fn();
vi.mock('@/lib/session/complete', () => ({ completeActivity: (...a: unknown[]) => completeMock(...a) }));
vi.mock('@/lib/item-bank/plan-bank', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/item-bank/plan-bank')>()),
  loadPlan: (...a: unknown[]) => loadPlanMock(...a),
}));

const storedItem = (key: string) => ({
  speaker: 'Woman',
  utterance: 'Did you attend the seminar?',
  options: ['A', 'B', 'C', 'D'].map((k) => ({ key: k, label: `Option ${k}` })),
  correct_key: key,
  explanation: 'Official key.',
  audio_url: '/toefl/choose-response/q.mp3',
});
const storedPlan = { items: ['A', 'C', 'B', 'D', 'A', 'B', 'C', 'D'].map(storedItem) };
const storedSentence = (sentence: string, id: number) => ({
  id,
  structure: 'subject verb object',
  tokens: sentence.replace('.', '').split(' '),
  correct_sentence: sentence,
  explanation: 'Word order.',
});
const storedSentencePlan = {
  items: Array.from({ length: TOEFL_BUILD_ITEMS }, (_, index) => storedSentence(`She reads the book number ${index + 1}.`, index + 1)),
};

import { submitClosedSetAction } from '@/actions/modes/closed-set';
import { TOEFL_BUILD_ITEMS } from '@/lib/bank-plans/toefl-build-sentence';
import { buildClosedEvaluation, restoreClosedSet, scoreClosedEntries } from '@/lib/toefl/closed-set';

beforeEach(() => {
  completeMock.mockReset().mockResolvedValue({ ok: true, data: { sessionId: 's1', score10: 5 } });
  loadPlanMock.mockReset().mockResolvedValue({ ok: true, data: storedPlan });
});

describe('scoreClosedEntries', () => {
  it('compares keys exactly and sentences ignoring case and punctuation', () => {
    const results = scoreClosedEntries([
      { id: 'a', selected: 'b', expected: 'b', match: 'key' },
      { id: 'b', selected: 'B', expected: 'b', match: 'key' },
      { id: 'c', selected: 'She has been studying hard.', expected: 'she has been studying hard', match: 'sentence' },
    ]);
    expect(results.map((r) => r.correct)).toEqual([true, false, true]);
  });

  it('builds a hits-over-total evaluation', () => {
    const results = scoreClosedEntries([
      { id: 'a', selected: 'b', expected: 'b', match: 'key' },
      { id: 'b', selected: 'a', expected: 'b', match: 'key' },
    ]);
    expect(buildClosedEvaluation(results)).toMatchObject({ kind: 'closed_set_evaluation', score: 1, score_max: 2 });
  });
});

describe('restoreClosedSet', () => {
  it('reads the final evaluation', () => {
    const results = [{ id: 'a', selected: 'b', expected: 'b', explanation: null, correct: true }];
    const restored = restoreClosedSet([
      { role: 'bob', msg_type: 'text', content_json: { kind: 'closed_plan', items: [] } },
      { role: 'bob', msg_type: 'evaluation', content_json: { kind: 'closed_set_evaluation', results, is_final: true } },
    ]);
    expect(restored).toEqual(results);
  });

  it('falls back to legacy per-item evaluations', () => {
    const restored = restoreClosedSet([
      { role: 'bob', msg_type: 'evaluation', content_json: { kind: 'closed', correct: false, selected: 'a', expected: 'b' } },
    ]);
    expect(restored).toEqual([{ id: '', selected: 'a', expected: 'b', explanation: null, correct: false }]);
  });

  it('returns null without evaluations', () => {
    expect(restoreClosedSet([{ role: 'bob', msg_type: 'text', content_json: { kind: 'closed_plan' } }])).toBeNull();
  });
});

describe('submitClosedSetAction', () => {
  it('opens the session on the submit and grades Choose a Response against the stored keys', async () => {
    const outcome = await submitClosedSetAction({
      mode: 'toefl_listen_choose_response',
      bankGroupId: 'g1',
      entries: [
        { id: 'g1-q1', selected: 'A', expected: 'A', match: 'key' },
        { id: 'g1-q2', selected: 'C', expected: 'C', match: 'key' },
      ],
    });
    expect(loadPlanMock).toHaveBeenCalledWith('g1', expect.anything());
    expect(completeMock).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'toefl_listen_choose_response', evaluation: expect.objectContaining({ score: 2, score_max: 8 }) }),
    );
    expect(outcome).toMatchObject({ sessionId: 's1' });
  });

  it('ignores answer keys forged by the client and persists the stored items', async () => {
    const outcome = await submitClosedSetAction({
      mode: 'toefl_listen_choose_response',
      bankGroupId: 'g1',
      entries: [{ id: 'g1-q1', selected: 'D', expected: 'D', match: 'key' }],
    });
    const call = completeMock.mock.calls[0][0];
    expect(call.evaluation).toMatchObject({ score: 0, score_max: 8 });
    expect(call.plan.items).toHaveLength(8);
    expect(call.plan.items[0]).toMatchObject({ variant_id: 'g1-q1', correct_key: 'A' });
    expect(outcome).toMatchObject({ results: expect.arrayContaining([expect.objectContaining({ id: 'g1-q1', expected: 'A', correct: false })]) });
  });

  it('rejects a Choose a Response submission whose bank set cannot be loaded', async () => {
    expect(
      await submitClosedSetAction({ mode: 'toefl_listen_choose_response', entries: [{ id: 'x', selected: 'A', expected: 'A', match: 'key' }] }),
    ).toEqual({ error: 'invalid_submission' });
    loadPlanMock.mockResolvedValue({ ok: false, code: 'no_content' });
    expect(
      await submitClosedSetAction({
        mode: 'toefl_listen_choose_response',
        bankGroupId: 'gone',
          entries: [{ id: 'x', selected: 'A', expected: 'A', match: 'key' }],
      }),
    ).toEqual({ error: 'invalid_submission' });
    expect(completeMock).not.toHaveBeenCalled();
  });

  it('grades Build a Sentence against the stored sentences, ignoring forged targets', async () => {
    loadPlanMock.mockResolvedValue({ ok: true, data: storedSentencePlan });
    const outcome = await submitClosedSetAction({
      mode: 'toefl_writing_build_sentence',
      bankGroupId: 'b1',
      entries: [
        { id: 'b1-1', selected: 'she reads the book number 1', expected: 'anything', match: 'sentence' },
        { id: 'b1-2', selected: 'book the reads she', expected: 'book the reads she', match: 'sentence' },
      ],
    });
    expect(loadPlanMock).toHaveBeenCalledWith('b1', expect.anything());
    const call = completeMock.mock.calls[0][0];
    expect(call.evaluation).toMatchObject({ score: 1, score_max: TOEFL_BUILD_ITEMS });
    expect(call.plan.items[1]).toMatchObject({ id: 'b1-2', target_sentence: 'She reads the book number 2.' });
    expect(outcome).toMatchObject({ results: expect.arrayContaining([expect.objectContaining({ id: 'b1-2', correct: false })]) });
  });

  it('rejects a Build a Sentence submission without a bank set', async () => {
    expect(
      await submitClosedSetAction({ mode: 'toefl_writing_build_sentence', entries: [{ id: 'x', selected: 'a', expected: 'a', match: 'sentence' }] }),
    ).toEqual({ error: 'invalid_submission' });
    expect(completeMock).not.toHaveBeenCalled();
  });

  it('rejects unknown modes and empty submissions without touching the session', async () => {
    expect(await submitClosedSetAction({ mode: 'other' as never, entries: [] })).toEqual({ error: 'invalid_submission' });
    expect(completeMock).not.toHaveBeenCalled();
  });

  it('surfaces lifecycle failures', async () => {
    completeMock.mockResolvedValue({ ok: false, code: 'persist_failed', retryable: true });
    loadPlanMock.mockResolvedValue({ ok: true, data: storedSentencePlan });
    const outcome = await submitClosedSetAction({
      mode: 'toefl_writing_build_sentence',
      bankGroupId: 'b1',
      entries: [{ id: 'x', selected: 'a', expected: 'a', match: 'sentence' }],
    });
    expect(outcome).toEqual({ error: 'persist_failed' });
  });
});
