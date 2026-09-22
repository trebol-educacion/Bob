vi.mock('server-only', () => ({}));

vi.mock('@/actions/assessment/queue-guard', () => ({
  hasPendingAssessment: vi.fn(),
}));

const profileMaybeSingle = vi.fn().mockResolvedValue({ data: { cefr_level_locked: false, cefr_active_level: null } });

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'student-1' } }, error: null }),
    },
    schema: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: profileMaybeSingle,
          }),
        }),
      }),
    }),
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }),
}));

describe('applyDefaultSkillLevelAction — pending assessment guard', () => {
  beforeEach(() => {
    profileMaybeSingle.mockResolvedValue({ data: { cefr_level_locked: false, cefr_active_level: null } });
  });

  it('rechaza con assessment_pending si hay una evaluación en cola para la destreza', async () => {
    const { hasPendingAssessment } = await import('@/actions/assessment/queue-guard');
    (hasPendingAssessment as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);

    const { applyDefaultSkillLevelAction } = await import('@/actions/skills/write');
    const result = await applyDefaultSkillLevelAction('speaking', 'a2');

    expect(result).toEqual({ ok: false, code: 'assessment_pending' });
  });

  it('aplica el nivel por defecto si no hay evaluación pendiente ni bloqueo', async () => {
    const { hasPendingAssessment } = await import('@/actions/assessment/queue-guard');
    (hasPendingAssessment as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

    const { applyDefaultSkillLevelAction } = await import('@/actions/skills/write');
    const result = await applyDefaultSkillLevelAction('speaking', 'a2');

    expect(result).toEqual({ ok: true });
  });
});

describe('applyDefaultSkillLevelAction — nivel bloqueado por el colegio', () => {
  beforeEach(() => {
    delete process.env.BOB_LEVEL_SELECTOR_ENABLED;
  });

  it('rechaza con level_locked si el colegio bloqueó el nivel y hay nivel de tenant', async () => {
    const { hasPendingAssessment } = await import('@/actions/assessment/queue-guard');
    (hasPendingAssessment as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    profileMaybeSingle.mockResolvedValueOnce({ data: { cefr_level_locked: true, cefr_active_level: 'b1' } });

    const { applyDefaultSkillLevelAction } = await import('@/actions/skills/write');
    const result = await applyDefaultSkillLevelAction('speaking', 'a2');

    expect(result).toEqual({ ok: false, code: 'level_locked' });
  });

  it('permite la elección manual con el flag de tester activo aunque el nivel esté bloqueado', async () => {
    process.env.BOB_LEVEL_SELECTOR_ENABLED = 'true';
    const { hasPendingAssessment } = await import('@/actions/assessment/queue-guard');
    (hasPendingAssessment as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    profileMaybeSingle.mockResolvedValueOnce({ data: { cefr_level_locked: true, cefr_active_level: 'b1' } });

    const { applyDefaultSkillLevelAction } = await import('@/actions/skills/write');
    const result = await applyDefaultSkillLevelAction('speaking', 'a2');

    expect(result).toEqual({ ok: true });
  });
});
