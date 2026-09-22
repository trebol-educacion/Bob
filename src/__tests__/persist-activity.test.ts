vi.mock('server-only', () => ({}));
vi.mock('next/server', () => ({ after: (cb: () => unknown) => cb() }));

function makeBuilder(finalValue: unknown) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.single = vi.fn(() => Promise.resolve(finalValue));
  builder.maybeSingle = vi.fn(() => Promise.resolve(finalValue));
  return builder;
}

const activityInsertSpy = vi.fn();

function makeSupabase() {
  const publicTables: Record<string, ReturnType<typeof makeBuilder>> = {
    profiles: makeBuilder({ data: { organization_id: 'org-1' }, error: null }),
    organizations: makeBuilder({ data: { allow_voice_storage: false }, error: null }),
  };

  const botTables: Record<string, ReturnType<typeof makeBuilder>> = {
    messages: makeBuilder({
      data: { id: 'msg-1', created_at: new Date(Date.now() - 5000).toISOString() },
      error: null,
    }),
    sessions: makeBuilder({
      data: { mode: 'cambridge_ket_reading', created_at: new Date(Date.now() - 5000).toISOString() },
      error: null,
    }),
    skill_levels: makeBuilder({ data: { cefr_level: 'a2' }, error: null }),
    activity_results: makeBuilder({ data: { id: 'result-1' }, error: null }),
  };

  botTables.activity_results.insert = vi.fn((row: unknown) => {
    activityInsertSpy(row);
    return botTables.activity_results;
  });

  return {
    schema: vi.fn(() => ({ from: vi.fn((t: string) => publicTables[t]) })),
    from: vi.fn((t: string) => botTables[t]),
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: vi.fn(),
}));

describe('persist-activity — activity_results on is_final', () => {
  beforeEach(async () => {
    activityInsertSpy.mockClear();
    const { createSupabaseServer } = await import('@/lib/supabase/server');
    (createSupabaseServer as ReturnType<typeof vi.fn>).mockImplementation(() => Promise.resolve(makeSupabase()));
  });

  it('inserts an activity_results row when an evaluation message has is_final: true', async () => {
    const { persistMessage } = await import('@/lib/persist-activity');

    await persistMessage({
      sessionId: 'session-1',
      userId: 'user-1',
      role: 'bob',
      msgType: 'evaluation',
      contentJson: { is_final: true, score: 8, score_max: 10 },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(activityInsertSpy).toHaveBeenCalledTimes(1);
    const row = activityInsertSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(row.organization_id).toBe('org-1');
    expect(row.started_at).toBeTruthy();
    expect(typeof row.duration_seconds).toBe('number');
  });

  it('does not insert when is_final is not true', async () => {
    const { persistMessage } = await import('@/lib/persist-activity');

    await persistMessage({
      sessionId: 'session-1',
      userId: 'user-1',
      role: 'bob',
      msgType: 'evaluation',
      contentJson: { is_final: false, score: 8, score_max: 10 },
    });

    expect(activityInsertSpy).not.toHaveBeenCalled();
  });

  it('falls back to bob.skill_levels for cefr_level when the mode has none (assessment_*)', async () => {
    const { persistActivityResult } = await import('@/lib/persist-activity');

    await persistActivityResult({
      sessionId: 'session-1',
      userId: 'user-1',
      messageId: 'msg-1',
      mode: 'assessment_listening',
      contentJson: { is_final: true, score: 5, score_max: 10 },
    });

    expect(activityInsertSpy).toHaveBeenCalledTimes(1);
    const row = activityInsertSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(row.cefr_level).toBe('a2');
  });
});
