vi.mock('server-only', () => ({}));

vi.mock('@/actions/assessment/queue-guard', () => ({
  hasPendingAssessment: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'student-1' } }, error: null }),
    },
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }),
}));

describe('applyDefaultSkillLevelAction — pending assessment guard', () => {
  it('rechaza con assessment_pending si hay una evaluación en cola para la destreza', async () => {
    const { hasPendingAssessment } = await import('@/actions/assessment/queue-guard');
    (hasPendingAssessment as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);

    const { applyDefaultSkillLevelAction } = await import('@/actions/skills/write');
    const result = await applyDefaultSkillLevelAction('speaking', 'a2');

    expect(result).toEqual({ ok: false, code: 'assessment_pending' });
  });

  it('aplica el nivel por defecto si no hay evaluación pendiente', async () => {
    const { hasPendingAssessment } = await import('@/actions/assessment/queue-guard');
    (hasPendingAssessment as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

    const { applyDefaultSkillLevelAction } = await import('@/actions/skills/write');
    const result = await applyDefaultSkillLevelAction('speaking', 'a2');

    expect(result).toEqual({ ok: true });
  });
});
