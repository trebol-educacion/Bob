vi.mock('server-only', () => ({}));

vi.mock('@/actions/assessment/queue-guard', () => ({
  hasPendingAssessment: vi.fn(),
}));

const profileMaybeSingle = vi.fn().mockResolvedValue({ data: { cefr_level_locked: false, cefr_active_level: null } });
const skillLevelMaybeSingle = vi.fn().mockResolvedValue({ data: null });

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
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: skillLevelMaybeSingle,
          }),
        }),
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }),
}));

describe('pickInitialSkillLevelAction — alta inicial del alumno', () => {
  beforeEach(() => {
    profileMaybeSingle.mockResolvedValue({ data: { cefr_level_locked: false, cefr_active_level: null } });
    skillLevelMaybeSingle.mockResolvedValue({ data: null });
  });

  it('rechaza con assessment_pending si hay una evaluación en cola para la destreza', async () => {
    const { hasPendingAssessment } = await import('@/actions/assessment/queue-guard');
    (hasPendingAssessment as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);

    const { pickInitialSkillLevelAction } = await import('@/actions/skills/write');
    const result = await pickInitialSkillLevelAction('speaking', 'a2');

    expect(result).toEqual({ ok: false, code: 'assessment_pending' });
  });

  it('permite el alta inicial si el alumno no tiene nivel previo ni bloqueo', async () => {
    const { hasPendingAssessment } = await import('@/actions/assessment/queue-guard');
    (hasPendingAssessment as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

    const { pickInitialSkillLevelAction } = await import('@/actions/skills/write');
    const result = await pickInitialSkillLevelAction('speaking', 'a2');

    expect(result).toEqual({ ok: true });
  });

  it('rechaza con level_locked si el colegio bloqueó el nivel y hay nivel de tenant', async () => {
    const { hasPendingAssessment } = await import('@/actions/assessment/queue-guard');
    (hasPendingAssessment as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    profileMaybeSingle.mockResolvedValueOnce({ data: { cefr_level_locked: true, cefr_active_level: 'b1' } });

    const { pickInitialSkillLevelAction } = await import('@/actions/skills/write');
    const result = await pickInitialSkillLevelAction('speaking', 'a2');

    expect(result).toEqual({ ok: false, code: 'level_locked' });
  });

  it('rechaza con level_already_set si la destreza ya tiene nivel asignado', async () => {
    const { hasPendingAssessment } = await import('@/actions/assessment/queue-guard');
    (hasPendingAssessment as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    skillLevelMaybeSingle.mockResolvedValueOnce({ data: { cefr_level: 'a2' } });

    const { pickInitialSkillLevelAction } = await import('@/actions/skills/write');
    const result = await pickInitialSkillLevelAction('speaking', 'b1');

    expect(result).toEqual({ ok: false, code: 'level_already_set' });
  });
});

describe('changeSkillLevelAction — cambio de nivel desde el dashboard', () => {
  beforeEach(() => {
    delete process.env.BOB_LEVEL_SELECTOR_ENABLED;
  });

  it('rechaza con tester_only si el flag de servidor está apagado', async () => {
    const { changeSkillLevelAction } = await import('@/actions/skills/write');
    const result = await changeSkillLevelAction('speaking', 'a2');

    expect(result).toEqual({ ok: false, code: 'tester_only' });
  });

  it('permite el cambio de nivel con el flag de tester activo', async () => {
    process.env.BOB_LEVEL_SELECTOR_ENABLED = 'true';
    const { hasPendingAssessment } = await import('@/actions/assessment/queue-guard');
    (hasPendingAssessment as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

    const { changeSkillLevelAction } = await import('@/actions/skills/write');
    const result = await changeSkillLevelAction('speaking', 'b1');

    expect(result).toEqual({ ok: true });
  });

  it('rechaza con assessment_pending aunque el flag esté activo si hay evaluación en cola', async () => {
    process.env.BOB_LEVEL_SELECTOR_ENABLED = 'true';
    const { hasPendingAssessment } = await import('@/actions/assessment/queue-guard');
    (hasPendingAssessment as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);

    const { changeSkillLevelAction } = await import('@/actions/skills/write');
    const result = await changeSkillLevelAction('speaking', 'b1');

    expect(result).toEqual({ ok: false, code: 'assessment_pending' });
  });
});
