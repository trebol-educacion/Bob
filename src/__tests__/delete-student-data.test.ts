vi.mock('server-only', () => ({}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'admin-id' } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { role: 'school_admin', organization_id: 'org-1' },
        error: null,
      }),
      delete: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }),
}));

describe('deleteStudentDataAction — module smoke', () => {
  it('loads without errors', async () => {
    const mod = await import('@/actions/admin/delete-student-data');
    expect(typeof mod.deleteStudentDataAction).toBe('function');
  });

  it('returns ok:false when actor and target are in different orgs (cross-org guard)', async () => {
    const { createSupabaseServer } = await import('@/lib/supabase/server');
    const mockFrom = vi.fn();
    let callCount = 0;

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ data: { role: 'school_admin', organization_id: 'org-A' }, error: null });
        }
        return Promise.resolve({ data: { organization_id: 'org-B' }, error: null });
      }),
      delete: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
    }));

    (createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-id' } }, error: null }),
      },
      from: mockFrom,
    });

    const { deleteStudentDataAction } = await import('@/actions/admin/delete-student-data');
    const result = await deleteStudentDataAction('student-in-org-B');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('forbidden');
    }
  });
});
