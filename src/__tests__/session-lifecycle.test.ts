import { describe, it, expect, vi, beforeEach } from 'vitest';

const createSessionMock = vi.fn();
const persistMessageMock = vi.fn();
const persistMessagesMock = vi.fn();
const persistResultMock = vi.fn();
const updateMock = vi.fn();
const existingResultMock = vi.fn();

vi.mock('@/actions/sessions', () => ({ createSessionAction: (...a: unknown[]) => createSessionMock(...a) }));
vi.mock('@/lib/persist-activity', () => ({
  persistMessage: (...a: unknown[]) => persistMessageMock(...a),
  persistMessages: (...a: unknown[]) => persistMessagesMock(...a),
  persistActivityResult: (...a: unknown[]) => persistResultMock(...a),
}));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: (table: string) => {
      if (table === 'sessions') {
        return {
          update: (values: unknown) => {
            updateMock(values);
            return { eq: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: { mode: 'cambridge_fce_reading_part1' }, error: null }) }) }) }) };
          },
        };
      }
      return { select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: existingResultMock() }) }) }) }) };
    },
  }),
}));

import { ensureSession, recordTurn, finishSession } from '@/lib/session/lifecycle';

beforeEach(() => {
  createSessionMock.mockReset().mockResolvedValue({ data: { id: 's1', user_id: 'u1' }, error: null });
  persistMessageMock.mockReset().mockResolvedValue({ id: 'm1' });
  persistMessagesMock.mockReset().mockResolvedValue({ ids: ['a', 'b'] });
  persistResultMock.mockReset().mockResolvedValue({ id: 'r1' });
  updateMock.mockReset();
  existingResultMock.mockReset().mockReturnValue(null);
});

describe('ensureSession', () => {
  it('no crea fila si ya hay sessionId', async () => {
    const result = await ensureSession({ mode: 'cambridge_fce_p1', sessionId: 's9' });
    expect(createSessionMock).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, data: { sessionId: 's9', userId: 'u1', created: false } });
  });

  it('crea la fila con el título canónico cuando no hay sesión', async () => {
    const result = await ensureSession({ mode: 'cambridge_fce_reading_part2' });
    expect(createSessionMock).toHaveBeenCalledWith({ mode: 'cambridge_fce_reading_part2', topic: null, title: 'Reading · Part 2 · Open Cloze' });
    expect(result).toEqual({ ok: true, data: { sessionId: 's1', userId: 'u1', created: true } });
  });

  it('propaga placement_required sin reintento', async () => {
    createSessionMock.mockResolvedValue({ data: null, error: 'placement_required' });
    expect(await ensureSession({ mode: 'cambridge_fce_p1' })).toEqual({ ok: false, code: 'placement_required', retryable: false });
  });
});

describe('recordTurn', () => {
  it('espera la escritura y devuelve los ids', async () => {
    const result = await recordTurn({
      sessionId: 's1',
      userId: 'u1',
      messages: [{ role: 'user', msgType: 'text', contentText: 'hi' }, { role: 'bob', msgType: 'text', contentText: 'yo' }],
    });
    expect(persistMessagesMock.mock.calls[0][0]).toHaveLength(2);
    expect(result).toEqual({ ok: true, data: { ids: ['a', 'b'] } });
  });

  it('señala fallo reintentable si el insert falla', async () => {
    persistMessagesMock.mockResolvedValue({ error: 'x' });
    expect(await recordTurn({ sessionId: 's1', userId: 'u1', messages: [{ role: 'user', msgType: 'text' }] })).toEqual({ ok: false, code: 'persist_failed', retryable: true });
  });
});

describe('finishSession', () => {
  it('escribe mensaje final, activity_results y sessions.score_10 en línea', async () => {
    const result = await finishSession({ sessionId: 's1', userId: 'u1', evaluation: { score: 6, score_max: 8 } });
    expect(updateMock).toHaveBeenCalledWith({ score_10: 7.5 });
    expect(persistMessageMock.mock.calls[0][0]).toMatchObject({ msgType: 'evaluation', skipActivityResult: true, contentJson: { is_final: true, score: 6 } });
    expect(persistResultMock.mock.calls[0][0]).toMatchObject({ sessionId: 's1', mode: 'cambridge_fce_reading_part1', messageId: 'm1' });
    expect(result).toEqual({ ok: true, data: { score10: 7.5, messageId: 'm1' } });
  });

  it('no duplica activity_results si ya existe', async () => {
    existingResultMock.mockReturnValue({ id: 'r0' });
    await finishSession({ sessionId: 's1', userId: 'u1', evaluation: { score: 1, score_max: 2 } });
    expect(persistResultMock).not.toHaveBeenCalled();
  });
});

describe('openSession', () => {
  it('persiste el opening solo si crea la sesión', async () => {
    const opening = [{ role: 'bob' as const, msgType: 'phrase' as const, contentJson: { a: 1 } }];
    const { openSession } = await import('@/lib/session/lifecycle');
    const created = await openSession({ mode: 'cambridge_fce_p1', opening });
    expect(created).toEqual({ ok: true, data: { sessionId: 's1', userId: 'u1' } });
    expect(persistMessagesMock).toHaveBeenCalledTimes(1);
    persistMessagesMock.mockClear();
    await openSession({ mode: 'cambridge_fce_p1', sessionId: 's9', opening });
    expect(persistMessagesMock).not.toHaveBeenCalled();
  });
});
