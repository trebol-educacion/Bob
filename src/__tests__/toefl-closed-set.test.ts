import { describe, it, expect, vi, beforeEach } from 'vitest';

const completeMock = vi.fn();
vi.mock('@/lib/session/complete', () => ({ completeActivity: (...a: unknown[]) => completeMock(...a) }));

import { submitClosedSetAction } from '@/actions/modes/closed-set';
import { buildClosedEvaluation, restoreClosedSet, scoreClosedEntries } from '@/lib/toefl/closed-set';

beforeEach(() => completeMock.mockReset().mockResolvedValue({ ok: true, data: { sessionId: 's1', score10: 5 } }));

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
  it('opens the session on the submit and returns graded results', async () => {
    const outcome = await submitClosedSetAction({
      mode: 'toefl_listen_choose_response',
      items: [{ id: 'i1' }],
      entries: [{ id: 'i1', selected: 'a', expected: 'a', match: 'key' }],
    });
    expect(completeMock).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'toefl_listen_choose_response', evaluation: expect.objectContaining({ score: 1, score_max: 1 }) }),
    );
    expect(outcome).toMatchObject({ sessionId: 's1' });
  });

  it('rejects unknown modes and empty submissions without touching the session', async () => {
    expect(await submitClosedSetAction({ mode: 'other' as never, items: [], entries: [] })).toEqual({ error: 'invalid_submission' });
    expect(completeMock).not.toHaveBeenCalled();
  });

  it('surfaces lifecycle failures', async () => {
    completeMock.mockResolvedValue({ ok: false, code: 'persist_failed', retryable: true });
    const outcome = await submitClosedSetAction({
      mode: 'toefl_writing_build_sentence',
      items: [],
      entries: [{ id: 'x', selected: 'a', expected: 'a', match: 'sentence' }],
    });
    expect(outcome).toEqual({ error: 'persist_failed' });
  });
});
