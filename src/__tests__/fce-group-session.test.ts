import { describe, it, expect, vi, beforeEach } from 'vitest';
import { L3_GROUP, L3_ITEMS, SECRET_EXPLANATION, SECRET_TRANSCRIPT } from './fce-group-fixtures';

vi.mock('server-only', () => ({}));

const fetchGroups = vi.fn();
const fetchGroupItems = vi.fn();
const createSessionAction = vi.fn();
const persistMessage = vi.fn();
const readSessionMessagesForCurrentOrUser = vi.fn();

vi.mock('@/actions/item-bank/repository', () => ({
  fetchGroups: (...args: unknown[]) => fetchGroups(...args),
  fetchGroupItems: (...args: unknown[]) => fetchGroupItems(...args),
}));
vi.mock('@/actions/sessions', () => ({ createSessionAction: (...args: unknown[]) => createSessionAction(...args) }));
vi.mock('@/lib/persist-activity', () => ({
  persistMessage: (...args: unknown[]) => persistMessage(...args),
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
  createSessionAction.mockResolvedValue({ data: { id: 'session-1', user_id: 'user-1' }, error: null });
  persistMessage.mockResolvedValue({ id: 'msg-1' });
});

describe('startGroupSession', () => {
  it('carga el ejercicio pregenerado sin clave ni transcript y lo persiste', async () => {
    const started = await startGroupSession(STRATEGY);
    expect('error' in started).toBe(false);
    const serialized = JSON.stringify(started);
    expect(serialized).not.toContain(SECRET_TRANSCRIPT);
    expect(serialized).not.toContain(SECRET_EXPLANATION);
    expect(serialized).not.toContain('correct_key');
    expect(fetchGroups).toHaveBeenCalledWith(expect.objectContaining({ exam_part: 'fce_listening_part3', status: 'published' }));
    const plan = persistMessage.mock.calls[0][0];
    expect(JSON.stringify(plan.contentJson)).not.toContain('correct_key');
    expect(JSON.stringify(plan.contentJson)).not.toContain(SECRET_TRANSCRIPT);
  });

  it('sin contenido devuelve un error claro y no crea sesion', async () => {
    fetchGroups.mockResolvedValue({ ok: true, data: [] });
    expect(await startGroupSession(STRATEGY)).toEqual({ error: 'No exercise available' });
    expect(createSessionAction).not.toHaveBeenCalled();
  });

  it('sin usuario devuelve error', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await startGroupSession(STRATEGY)).toEqual({ error: 'Not authenticated' });
  });
});

describe('submitGroupSession', () => {
  const planMessage = async () => {
    const started = await startGroupSession(STRATEGY);
    if ('error' in started) throw new Error('start failed');
    const contentJson = persistMessage.mock.calls[0][0].contentJson;
    persistMessage.mockClear();
    return { role: 'bob', content_json: contentJson };
  };

  it('corrige contra la clave del servidor y persiste la nota 0-10 final', async () => {
    const plan = await planMessage();
    readSessionMessagesForCurrentOrUser.mockResolvedValue([plan]);

    const answers = { 'l3-item-1': 'E', 'l3-item-2': 'B', 'l3-item-3': 'H', 'l3-item-4': 'G', 'l3-item-5': 'A' };
    const graded = await submitGroupSession(STRATEGY, 'session-1', answers);

    expect(graded).toMatchObject({ correct: 3, total: 5, score_10: 6 });
    const evaluation = persistMessage.mock.calls[0][0];
    expect(evaluation.msgType).toBe('evaluation');
    expect(evaluation.contentJson).toMatchObject({ score: 3, score_max: 5, score_10: 6, is_final: true });
  });

  it('un segundo envio devuelve el resultado guardado sin persistir de nuevo', async () => {
    const plan = await planMessage();
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
    const outcome = await submitGroupSession(STRATEGY, 'session-1', {});
    expect(outcome).toMatchObject({ correct: 5, score_10: 10 });
    expect(persistMessage).not.toHaveBeenCalled();
  });

  it('sin plan en la sesion devuelve error', async () => {
    readSessionMessagesForCurrentOrUser.mockResolvedValue([]);
    expect(await submitGroupSession(STRATEGY, 'session-x', {})).toEqual({ error: 'Could not load exercise' });
  });

  it('si no se puede guardar el resultado devuelve error para reintentar', async () => {
    const plan = await planMessage();
    readSessionMessagesForCurrentOrUser.mockResolvedValue([plan]);
    persistMessage.mockResolvedValue({ error: 'db' });
    expect(await submitGroupSession(STRATEGY, 'session-1', {})).toEqual({ error: 'Could not save result' });
  });
});
