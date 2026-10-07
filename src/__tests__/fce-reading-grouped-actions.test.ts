import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fx from './fce-grouped-fixtures';

vi.mock('server-only', () => ({}));

const recordTurnMock = vi.fn();
const finishMock = vi.fn();
const ensureMock = vi.fn();
const fetchGroupsMock = vi.fn();
const fetchGroupItemsMock = vi.fn();
const readMessagesMock = vi.fn();

function messagesQuery() {
  const query: Record<string, unknown> = {};
  query.select = () => query;
  query.eq = () => query;
  query.order = () => query;
  query.limit = () => Promise.resolve({ data: [], error: null });
  return query;
}

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: () => messagesQuery(),
  }),
}));
vi.mock('@/actions/item-bank/repository', () => ({
  fetchGroups: (...a: unknown[]) => fetchGroupsMock(...a),
  fetchGroupItems: (...a: unknown[]) => fetchGroupItemsMock(...a),
}));
vi.mock('@/lib/session/lifecycle', () => ({
  ensureSession: (...a: unknown[]) => ensureMock(...a),
  recordTurn: (...a: unknown[]) => recordTurnMock(...a),
  finishSession: (...a: unknown[]) => finishMock(...a),
}));
vi.mock('@/lib/persist-activity', () => ({
  readSessionMessagesForCurrentOrUser: (...a: unknown[]) => readMessagesMock(...a),
}));

import {
  startFCEReadingExerciseAction,
  submitFCEReadingExerciseAction,
} from '@/actions/modes/fce-reading-grouped';

beforeEach(() => {
  recordTurnMock.mockReset().mockResolvedValue({ ok: true, data: { ids: [] } });
  finishMock.mockReset().mockResolvedValue({ ok: true, data: { score10: 5, messageId: 'm' } });
  ensureMock.mockReset().mockResolvedValue({ ok: true, data: { sessionId: 's1', userId: 'user-1', created: true } });
  fetchGroupsMock.mockReset().mockResolvedValue({ ok: true, data: [fx.KEY_WORD_GROUP] });
  fetchGroupItemsMock.mockReset().mockResolvedValue({ ok: true, data: fx.KEY_WORD_ITEMS });
  readMessagesMock.mockReset().mockResolvedValue([]);
});

describe('startFCEReadingExerciseAction', () => {
  it('returns the exercise without keys or accepted answers and creates no session', async () => {
    const result = await startFCEReadingExerciseAction({ part: 'fce_reading_part4' });
    expect('error' in result).toBe(false);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('is said to be');
    expect(serialized).not.toContain('accepted');
    expect(ensureMock).not.toHaveBeenCalled();
  });

  it('queries only published B2 groups of the requested part', async () => {
    await startFCEReadingExerciseAction({ part: 'fce_reading_part4' });
    expect(fetchGroupsMock).toHaveBeenCalledWith(
      expect.objectContaining({ exam: 'fce', cefr_level: 'b2', exam_part: 'fce_reading_part4', status: 'published' })
    );
  });

  it('returns a clear error when there is no content', async () => {
    fetchGroupsMock.mockResolvedValue({ ok: true, data: [] });
    expect(await startFCEReadingExerciseAction({ part: 'fce_reading_part4' })).toEqual({ error: 'No exercise available' });
  });

  it('rejects unsupported parts', async () => {
    expect(await startFCEReadingExerciseAction({ part: 'fce_reading_part7' })).toEqual({ error: 'Unsupported part' });
  });
});

describe('submitFCEReadingExerciseAction', () => {
  const input = {
    sessionId: 's1',
    groupId: 'group-fce_reading_part4',
    part: 'fce_reading_part4',
    answers: { 25: 'is said to be', 26: 'have difficulty' },
  };
  const plan = {
    role: 'bob',
    content_json: {
      kind: 'fce_group_plan',
      exam_part: 'fce_reading_part4',
      exercise: { groupId: 'group-fce_reading_part4' },
    },
  };

  it('grades server-side and finishes the session with the final 0-10 evaluation', async () => {
    readMessagesMock.mockResolvedValue([plan]);
    ensureMock.mockResolvedValue({ ok: true, data: { sessionId: 's1', userId: 'user-1', created: false } });
    const result = await submitFCEReadingExerciseAction(input);
    expect(result).toMatchObject({ sessionId: 's1', result: { correct: 1, total: 2, score10: 5 } });
    expect(finishMock.mock.calls[0][0].evaluation).toMatchObject({ score: 1, score_max: 2, score_10: 5 });
  });

  it('rejects a session without a plan of this part for the user', async () => {
    expect(await submitFCEReadingExerciseAction(input)).toEqual({ error: 'Could not load exercise' });
    expect(finishMock).not.toHaveBeenCalled();
  });

  it('does not grade twice and returns the stored result', async () => {
    const stored = { correct: 2, total: 2, score10: 10, results: [] };
    readMessagesMock.mockResolvedValue([
      plan,
      { role: 'bob', content_json: { kind: 'fce_group_evaluation', exam_part: 'fce_reading_part4', is_final: true, result: stored } },
    ]);
    expect(await submitFCEReadingExerciseAction(input)).toEqual({ sessionId: 's1', result: stored });
    expect(finishMock).not.toHaveBeenCalled();
  });
});
