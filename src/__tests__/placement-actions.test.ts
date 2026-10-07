import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: vi.fn(),
}));

vi.mock('@/actions/item-bank/repository', () => ({
  fetchGroups: vi.fn(),
  fetchGroupItems: vi.fn(),
}));

vi.mock('@/lib/item-bank/content-source', () => ({
  pickContent: vi.fn(),
}));

vi.mock('@/actions/assessment/shared', () => ({
  resolveCooldownDays: vi.fn().mockResolvedValue(7),
}));

vi.mock('@/actions/assessment/queue-guard', () => ({
  hasPendingAssessment: vi.fn().mockResolvedValue(false),
}));

const USER = { id: 'user-1' };

const GROUP = {
  id: 'group-a2-1',
  exam: 'ket',
  skill: 'listening',
  cefr_level: 'a2',
  difficulty: 1,
  purpose: 'placement',
  module_code: null,
  stimulus_text: null,
  stimulus_audio_url: null,
  stimulus_image_url: null,
  source: 'official',
  status: 'published',
  created_at: '2026-01-01T00:00:00.000Z',
};

const ITEM = {
  id: 'item-1',
  group_id: 'group-a2-1',
  group_order: 1,
  correct_key: 'A',
  question: 'Q1',
  options: [{ key: 'A', label: 'A' }],
};

function makeSingleQuery(result: { data: unknown; error: unknown }) {
  const query: Record<string, unknown> = {};
  query.select = vi.fn().mockReturnValue(query);
  query.eq = vi.fn().mockReturnValue(query);
  query.order = vi.fn().mockReturnValue(query);
  query.limit = vi.fn().mockReturnValue(query);
  query.insert = vi.fn().mockReturnValue(query);
  query.update = vi.fn().mockReturnValue(query);
  query.upsert = vi.fn().mockResolvedValue(result);
  query.single = vi.fn().mockResolvedValue(result);
  query.maybeSingle = vi.fn().mockResolvedValue(result);
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return query;
}

function buildSupabaseMock(overrides: Record<string, { data: unknown; error: unknown }>) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: USER } }) },
    from: vi.fn((table: string) => makeSingleQuery(overrides[table] ?? { data: null, error: null })),
  };
}

beforeEach(() => {
  vi.resetModules();
});

describe('startPlacementAction', () => {
  it('sin usuario autenticado devuelve error unauthenticated', async () => {
    const { createSupabaseServer } = await import('@/lib/supabase/server');
    vi.mocked(createSupabaseServer).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as never);

    const { startPlacementAction } = await import('@/actions/placement/start');
    const result = await startPlacementAction('listening');
    expect(result).toEqual({ status: 'error', code: 'unauthenticated', retryable: false });
  });

  it('sin item_groups de placement devuelve error visible no_content, nunca un fallback silencioso', async () => {
    const { createSupabaseServer } = await import('@/lib/supabase/server');
    vi.mocked(createSupabaseServer).mockResolvedValue(
      buildSupabaseMock({
        placement_attempts: { data: null, error: null },
        test_configs: { data: null, error: null },
      }) as never
    );

    const { pickContent } = await import('@/lib/item-bank/content-source');
    vi.mocked(pickContent).mockResolvedValue({ ok: false, code: 'no_content', retryable: false });

    const { startPlacementAction } = await import('@/actions/placement/start');
    const result = await startPlacementAction('listening');
    expect(result).toEqual({ status: 'error', code: 'no_content', retryable: false });
  });

  it('la seleccion pide siempre purpose placement, framework cefr y el nivel del motor', async () => {
    const { createSupabaseServer } = await import('@/lib/supabase/server');
    vi.mocked(createSupabaseServer).mockResolvedValue(
      buildSupabaseMock({
        placement_attempts: { data: { id: 'attempt-1' }, error: null },
        test_configs: { data: null, error: null },
      }) as never
    );

    const { pickContent } = await import('@/lib/item-bank/content-source');
    vi.mocked(pickContent).mockResolvedValue({ ok: true, data: { kind: 'group', group: GROUP as never, items: [ITEM as never] } });

    const { startPlacementAction } = await import('@/actions/placement/start');
    await startPlacementAction('reading');
    expect(pickContent).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'placement', framework: 'cefr', skill: 'reading', cefr: 'a1', groupsOnly: true })
    );
  });

  it('con contenido curado crea el intento y devuelve el primer paso', async () => {
    const { createSupabaseServer } = await import('@/lib/supabase/server');
    vi.mocked(createSupabaseServer).mockResolvedValue(
      buildSupabaseMock({
        placement_attempts: { data: { id: 'attempt-1' }, error: null },
        test_configs: { data: null, error: null },
      }) as never
    );

    const { pickContent } = await import('@/lib/item-bank/content-source');
    vi.mocked(pickContent).mockResolvedValue({ ok: true, data: { kind: 'group', group: GROUP as never, items: [ITEM as never] } });

    const { startPlacementAction } = await import('@/actions/placement/start');
    const result = await startPlacementAction('listening');
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.attempt_id).toBe('attempt-1');
      expect(result.level).toBe('a1');
      expect(result.items).toHaveLength(1);
    }
  });

  it('error de Supabase al leer el intento existente devuelve error db_error reintentable', async () => {
    const { createSupabaseServer } = await import('@/lib/supabase/server');
    vi.mocked(createSupabaseServer).mockResolvedValue(
      buildSupabaseMock({
        placement_attempts: { data: null, error: { message: 'boom' } },
      }) as never
    );

    const { startPlacementAction } = await import('@/actions/placement/start');
    const result = await startPlacementAction('reading');
    expect(result).toEqual({ status: 'error', code: 'db_error', retryable: true });
  });
});

describe('answerPlacementStepAction', () => {
  it('intento inexistente o de otro usuario se rechaza como invalid_step', async () => {
    const { createSupabaseServer } = await import('@/lib/supabase/server');
    vi.mocked(createSupabaseServer).mockResolvedValue(
      buildSupabaseMock({
        placement_attempts: { data: null, error: null },
      }) as never
    );

    const { answerPlacementStepAction } = await import('@/actions/placement/answer');
    const result = await answerPlacementStepAction('attempt-x', 'listening', 'group-a2-1', []);
    expect(result).toEqual({ status: 'error', code: 'invalid_step' });
  });

  it('grupo ya respondido en el intento se rechaza (no permite repetir pasos)', async () => {
    const { createSupabaseServer } = await import('@/lib/supabase/server');
    vi.mocked(createSupabaseServer).mockResolvedValue(
      buildSupabaseMock({
        placement_attempts: {
          data: { id: 'attempt-1', state: { outcomes: [{ level: 'a2', correct: 8, total: 10, groupId: 'group-a2-1' }] } },
          error: null,
        },
      }) as never
    );

    const { answerPlacementStepAction } = await import('@/actions/placement/answer');
    const result = await answerPlacementStepAction('attempt-1', 'listening', 'group-a2-1', []);
    expect(result).toEqual({ status: 'error', code: 'invalid_step' });
  });
});
