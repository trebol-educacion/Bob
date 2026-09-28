vi.mock('server-only', () => ({}));

const DELETED_TABLES = [
  'messages',
  'sessions',
  'activity_results',
  'usage_daily',
  'skill_levels',
  'skill_level_history',
  'challenge_attempts',
  'assessment_queue',
  'practice_sessions',
  'practice_messages',
  'practice_images',
];

function makeSupabase(profileByCall: Array<{ role?: string; organization_id: string }>) {
  let profileCall = 0;
  const from = vi.fn((table: string) => {
    if (DELETED_TABLES.includes(table)) {
      return {
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
        }),
      };
    }
    if (table === 'audit_log') {
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-id' } }, error: null }),
    },
    schema: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          const profile = profileByCall[profileCall] ?? profileByCall[profileByCall.length - 1];
          profileCall += 1;
          return Promise.resolve({ data: profile, error: null });
        }),
      }),
    }),
    from,
    storage: {
      from: vi.fn().mockReturnValue({
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    },
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: vi.fn(),
}));

describe('deleteStudentDataAction — module smoke', () => {
  it('loads without errors', async () => {
    const mod = await import('@/actions/admin/delete-student-data');
    expect(typeof mod.deleteStudentDataAction).toBe('function');
  });

  it('returns ok:false when actor and target are in different orgs (cross-org guard)', async () => {
    const { createSupabaseServer } = await import('@/lib/supabase/server');
    (createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeSupabase([
        { role: 'school_admin', organization_id: 'org-A' },
        { organization_id: 'org-B' },
      ]),
    );

    const { deleteStudentDataAction } = await import('@/actions/admin/delete-student-data');
    const result = await deleteStudentDataAction('student-in-org-B');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('forbidden');
    }
  });

  it('deletes from every table with student data and reports counts', async () => {
    const { createSupabaseServer } = await import('@/lib/supabase/server');
    (createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeSupabase([
        { role: 'school_admin', organization_id: 'org-A' },
        { organization_id: 'org-A' },
      ]),
    );

    const { deleteStudentDataAction } = await import('@/actions/admin/delete-student-data');
    const result = await deleteStudentDataAction('student-1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.deletedMessages).toBe(1);
      expect(result.deletedActivityResults).toBe(1);
      expect(result.deletedUsageDaily).toBe(1);
      expect(result.deletedSkillLevels).toBe(1);
      expect(result.deletedSkillLevelHistory).toBe(1);
      expect(result.deletedChallengeAttempts).toBe(1);
      expect(result.deletedAssessmentQueue).toBe(1);
      expect(result.deletedPracticeSessions).toBe(1);
      expect(result.deletedPracticeMessages).toBe(1);
      expect(result.deletedPracticeImages).toBe(1);
    }
  });
});
