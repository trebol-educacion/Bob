vi.mock('server-only', () => ({}));

const gte = vi.fn().mockReturnThis();
const lte = vi.fn().mockReturnThis();

type Builder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  then: (resolve: (value: { data: unknown[] }) => void) => void;
};

function makeBuilder(): Builder {
  const builder = {} as Builder;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.gte = vi.fn((...args: unknown[]) => {
    gte(...args);
    return builder;
  });
  builder.lte = vi.fn((...args: unknown[]) => {
    lte(...args);
    return builder;
  });
  builder.then = (resolve) => resolve({ data: [] });
  return builder;
}

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'student-1' } }, error: null }) },
    from: vi.fn(() => makeBuilder()),
  }),
}));

describe('getStudentStatsAction — optional period', () => {
  beforeEach(() => {
    gte.mockClear();
    lte.mockClear();
  });

  it('does not filter by date when no period is given', async () => {
    const { getStudentStatsAction } = await import('@/actions/stats');
    const result = await getStudentStatsAction();

    expect(gte).not.toHaveBeenCalled();
    expect(lte).not.toHaveBeenCalled();
    expect(result.rows).toEqual([]);
  });

  it('filters by from/to when a period is given', async () => {
    const { getStudentStatsAction } = await import('@/actions/stats');
    await getStudentStatsAction({ from: '2026-09-01', to: '2026-09-30' });

    expect(gte).toHaveBeenCalledWith('created_at', '2026-09-01');
    expect(lte).toHaveBeenCalledWith('created_at', '2026-09-30');
  });
});
