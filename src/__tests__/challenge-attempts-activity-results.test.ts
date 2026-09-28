vi.mock('server-only', () => ({}));

const activityInsertSpy = vi.fn().mockResolvedValue({ error: null });
const attemptInsertSpy = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/lib/activity/profile-snapshot', () => ({
  getProfileSnapshot: vi.fn().mockResolvedValue({ organizationId: 'org-1', allowVoiceStorage: false }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'student-1' } }, error: null }) },
    from: vi.fn((table: string) => {
      if (table === 'challenge_attempts') return { insert: attemptInsertSpy };
      if (table === 'activity_results') return { insert: activityInsertSpy };
      throw new Error(`unexpected table: ${table}`);
    }),
  }),
}));

describe('saveChallengeAttemptAction — writes activity_results per section (Q13)', () => {
  beforeEach(() => {
    activityInsertSpy.mockClear();
    attemptInsertSpy.mockClear();
  });

  it('inserts one activity_results row per part, objective and qualitative', async () => {
    const { saveChallengeAttemptAction } = await import('@/actions/challenge/attempts');

    const result = await saveChallengeAttemptAction({
      framework: 'cambridge_a2',
      examId: 'cambridge-a2-key',
      examTitle: 'A2 Key',
      objectiveCorrect: 4,
      objectiveTotal: 5,
      answers: {},
      results: [
        { id: 'listening-part1', title: 'Listening Part 1', skill: 'listening', kind: 'objective', correct: 4, total: 5 },
        { id: 'writing-part1', title: 'Writing Part 1', skill: 'writing', kind: 'qualitative' },
      ],
    });

    expect(result.ok).toBe(true);
    expect(activityInsertSpy).toHaveBeenCalledTimes(1);
    const rows = activityInsertSpy.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      skill: 'listening',
      measure_type: 'score',
      raw_score: 4,
      max_score: 5,
      cefr_level: 'a2',
      organization_id: 'org-1',
    });
    expect(rows[1]).toMatchObject({ skill: 'writing', measure_type: 'rubric', raw_score: null });
  });
});
