import { describe, it, expect, vi, beforeEach } from 'vitest';
import { L3_GROUP, L3_ITEMS, SECRET_EXPLANATION, SECRET_TRANSCRIPT } from './fce-group-fixtures';

vi.mock('server-only', () => ({}));

const fetchGroups = vi.fn();
const fetchGroupItems = vi.fn();
const ensureSession = vi.fn();
const recordTurn = vi.fn();
const finishSession = vi.fn();
const readSessionMessagesForCurrentOrUser = vi.fn();

vi.mock('@/actions/item-bank/repository', () => ({
  fetchGroups: (...args: unknown[]) => fetchGroups(...args),
  fetchGroupItems: (...args: unknown[]) => fetchGroupItems(...args),
}));
vi.mock('@/lib/session/lifecycle', () => ({
  ensureSession: (...args: unknown[]) => ensureSession(...args),
  recordTurn: (...args: unknown[]) => recordTurn(...args),
  finishSession: (...args: unknown[]) => finishSession(...args),
}));
vi.mock('@/lib/persist-activity', () => ({
  readSessionMessagesForCurrentOrUser: (...args: unknown[]) => readSessionMessagesForCurrentOrUser(...args),
}));

const chain: Record<string, unknown> = {};
for (const name of ['select', 'eq', 'order']) chain[name] = () => chain;
chain.limit = () => Promise.resolve({ data: [], error: null });
const getUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => ({ auth: { getUser }, from: () => chain }),
}));

import { startGroupSession, submitGroupSession } from '@/lib/item-bank/group-session';
import { createGroupStrategy, type GroupPartConfig } from '@/lib/item-bank/group-strategy';
import { matchesLetterKey } from '@/lib/item-bank/group-grading';

const CONFIG: GroupPartConfig = {
  mode: 'cambridge_fce_listening_part3',
  examPart: 'fce_listening_part3',
  skill: 'listening',
  title: 'Listening Part 3',
  matcher: matchesLetterKey,
};
const STRATEGY = createGroupStrategy(CONFIG);

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  fetchGroups.mockResolvedValue({ ok: true, data: [L3_GROUP] });
  fetchGroupItems.mockResolvedValue({ ok: true, data: L3_ITEMS });
  ensureSession.mockResolvedValue({ ok: true, data: { sessionId: 'session-1', userId: 'user-1', created: true } });
  recordTurn.mockResolvedValue({ ok: true, data: { ids: ['a'] } });
  finishSession.mockResolvedValue({ ok: true, data: { score10: 6, messageId: 'm' } });
});

describe('startGroupSession', () => {
  it('carga el ejercicio pregenerado sin clave ni transcript y no crea sesión', async () => {
    const started = await startGroupSession(STRATEGY);
    expect('error' in started).toBe(false);
    const serialized = JSON.stringify(started);
    expect(serialized).not.toContain(SECRET_TRANSCRIPT);
    expect(serialized).not.toContain(SECRET_EXPLANATION);
    expect(serialized).not.toContain('correct_key');
    expect(fetchGroups).toHaveBeenCalledWith(expect.objectContaining({ exam_part: 'fce_listening_part3', status: 'published' }));
    expect(ensureSession).not.toHaveBeenCalled();
    expect(recordTurn).not.toHaveBeenCalled();
  });

  it('sin contenido devuelve un error claro y no crea sesion', async () => {
    fetchGroups.mockResolvedValue({ ok: true, data: [] });
    expect(await startGroupSession(STRATEGY)).toEqual({ error: 'No exercise available' });
    expect(ensureSession).not.toHaveBeenCalled();
  });

  it('sin usuario devuelve error', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await startGroupSession(STRATEGY)).toEqual({ error: 'Not authenticated' });
  });
});

describe('submitGroupSession', () => {
  const answers = { 'l3-item-1': 'E', 'l3-item-2': 'B', 'l3-item-3': 'H', 'l3-item-4': 'G', 'l3-item-5': 'A' };

  it('primer envío: crea sesión, guarda plan sin secretos y cierra con la nota 0-10', async () => {
    const outcome = await submitGroupSession(STRATEGY, { groupId: L3_GROUP.id, answers });

    expect(outcome).toMatchObject({ sessionId: 'session-1', result: { correct: 3, total: 5, score_10: 6 } });
    expect(ensureSession).toHaveBeenCalledWith({ mode: 'cambridge_fce_listening_part3', sessionId: undefined });
    const turn = recordTurn.mock.calls[0][0];
    const plan = turn.messages.find((m: { role: string }) => m.role === 'bob');
    expect(JSON.stringify(plan.contentJson)).not.toContain('correct_key');
    expect(JSON.stringify(plan.contentJson)).not.toContain(SECRET_TRANSCRIPT);
    expect(turn.messages.some((m: { role: string }) => m.role === 'user')).toBe(true);
    expect(finishSession.mock.calls[0][0].evaluation).toMatchObject({ score: 3, score_max: 5, score_10: 6 });
  });

  it('un segundo envio devuelve el resultado guardado sin persistir de nuevo', async () => {
    const plan = { role: 'bob', content_json: { kind: 'fce_group_plan', exam_part: 'fce_listening_part3', exercise: { groupId: L3_GROUP.id } } };
    const evaluation = {
      role: 'bob',
      content_json: {
        kind: 'fce_group_evaluation',
        exam_part: 'fce_listening_part3',
        is_final: true,
        result: { correct: 5, total: 5, score_10: 10, results: [] },
      },
    };
    readSessionMessagesForCurrentOrUser.mockResolvedValue([plan, evaluation]);
    const outcome = await submitGroupSession(STRATEGY, { sessionId: 'session-1', groupId: L3_GROUP.id, answers: {} });
    expect(outcome).toMatchObject({ sessionId: 'session-1', result: { correct: 5, score_10: 10 } });
    expect(finishSession).not.toHaveBeenCalled();
  });

  it('sin plan en la sesion devuelve error', async () => {
    readSessionMessagesForCurrentOrUser.mockResolvedValue([]);
    expect(await submitGroupSession(STRATEGY, { sessionId: 'session-x', groupId: 'g', answers: {} })).toEqual({ error: 'Could not load exercise' });
  });

  it('si no se puede guardar el resultado devuelve error para reintentar', async () => {
    finishSession.mockResolvedValue({ ok: false, code: 'persist_failed', retryable: true });
    expect(await submitGroupSession(STRATEGY, { groupId: L3_GROUP.id, answers })).toEqual({ error: 'Could not save result' });
  });
});
