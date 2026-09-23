vi.mock('server-only', () => ({}));

const user = { id: 'student-1' };

function buildOkSupabase(row: Record<string, unknown>) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: row, error: null }),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }),
  };
}

function buildDegradedSupabase() {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '42P01', message: 'relation "bob.practice_sessions" does not exist' },
      }),
    }),
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: vi.fn(),
}));

describe('practice repository', () => {
  beforeEach(async () => {
    const { resetPracticeRepositoryHealthForTests } = await import('@/lib/practice/repository-health');
    resetPracticeRepositoryHealthForTests();
  });

  it('createPracticeSessionAction inserta y devuelve la fila', async () => {
    const { createSupabaseServer } = await import('@/lib/supabase/server');
    (createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      buildOkSupabase({ id: 'session-1', mode: 'conversation' })
    );

    const { createPracticeSessionAction } = await import('@/actions/practice/repository');
    const result = await createPracticeSessionAction({
      mode: 'conversation',
      topic: 'a chat',
      cefrLevel: 'b1',
      seed: { angle: 'a', character: 'b', tone: 'c', topic: 'a chat' },
      organizationId: 'org-1',
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe('session-1');
  });

  it('addPracticeTurnAction inserta un turno', async () => {
    const { createSupabaseServer } = await import('@/lib/supabase/server');
    (createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      buildOkSupabase({ id: 'msg-1', role: 'student' })
    );

    const { addPracticeTurnAction } = await import('@/actions/practice/repository');
    const result = await addPracticeTurnAction({ sessionId: 'session-1', role: 'student', content: 'hi' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe('msg-1');
  });

  it('savePracticeImageAction inserta una imagen', async () => {
    const { createSupabaseServer } = await import('@/lib/supabase/server');
    (createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      buildOkSupabase({ id: 'img-1', image_url: 'https://x/y.png' })
    );

    const { savePracticeImageAction } = await import('@/actions/practice/repository');
    const result = await savePracticeImageAction({
      sessionId: 'session-1',
      prompt: 'a scene',
      imageUrl: 'https://x/y.png',
      model: 'gemini-2.5-flash-image',
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe('img-1');
  });

  it('closePracticeSessionAction actualiza la sesion con turn_count y rubrica', async () => {
    const { createSupabaseServer } = await import('@/lib/supabase/server');
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === 'practice_messages') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
          };
        }
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }),
    };
    (createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValueOnce(supabase);

    const { closePracticeSessionAction } = await import('@/actions/practice/repository');
    const result = await closePracticeSessionAction({
      sessionId: 'session-1',
      rubricScore: 8.5,
      rubricDetail: { participation: 10, fluency: 9, independence: 8, comprehension: 8 },
    });

    expect(result.ok).toBe(true);
  });

  it('degrada sin romper si la tabla no existe (42P01)', async () => {
    const { createSupabaseServer } = await import('@/lib/supabase/server');
    (createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValueOnce(buildDegradedSupabase());

    const { createPracticeSessionAction } = await import('@/actions/practice/repository');
    const result = await createPracticeSessionAction({
      mode: 'conversation',
      topic: null,
      cefrLevel: null,
      seed: { angle: 'a', character: 'b', tone: 'c', topic: 'x' },
      organizationId: null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('degraded');
      expect(result.degraded).toBe(true);
    }
  });
});
