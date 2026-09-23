vi.mock('server-only', () => ({}));

vi.mock('@/actions/practice/repository', () => ({
  createPracticeSessionAction: vi.fn(),
  findOpenPracticeSessionAction: vi.fn(),
  listPracticeMessagesAction: vi.fn(),
}));

import {
  createPracticeSessionAction,
  findOpenPracticeSessionAction,
  listPracticeMessagesAction,
} from '@/actions/practice/repository';

const BASE_INPUT = {
  mode: 'conversation' as const,
  skillLevels: null,
  cefrActiveLevel: null,
  organizationId: 'org-1',
};

describe('resolvePracticeSessionAction — arranque y reanudacion sin bloquear en Gemini (P2.2, P2.6)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('sin sesion abierta: crea una sesion nueva sin llamar a Gemini', async () => {
    (findOpenPracticeSessionAction as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, data: null });
    (createPracticeSessionAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: { id: 'session-new', mode: 'conversation' },
    });

    const { resolvePracticeSessionAction } = await import('@/actions/practice/start');
    const result = await resolvePracticeSessionAction(BASE_INPUT);

    expect(result.resumed).toBe(false);
    expect(result.sessionId).toBe('session-new');
    expect(result.messages).toEqual([]);
    expect(result.turnSignals).toEqual([]);
  });

  it('con sesion abierta y turnos previos: restaura los mensajes en vez de crear una sesion nueva', async () => {
    (findOpenPracticeSessionAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: {
        id: 'session-open',
        mode: 'situation',
        cefr_level: 'a2',
        seed: { angle: 'a', character: 'b', tone: 'c', topic: 'ordering food' },
      },
    });
    (listPracticeMessagesAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: [
        { role: 'bob', content: 'Hi there!', hint_used: false, model_answer_used: false, audio_url: null },
        { role: 'student', content: 'Hello!', hint_used: true, model_answer_used: false, audio_url: null },
        { role: 'bob', content: 'Nice to meet you.', hint_used: false, model_answer_used: false, audio_url: null },
      ],
    });

    const { resolvePracticeSessionAction } = await import('@/actions/practice/start');
    const result = await resolvePracticeSessionAction(BASE_INPUT);

    expect(result.resumed).toBe(true);
    expect(result.sessionId).toBe('session-open');
    expect(result.mode).toBe('situation');
    expect(result.messages).toHaveLength(3);
    expect(result.messages[0]).toEqual({ role: 'model', text: 'Hi there!' });
    expect(result.messages[1]).toEqual({ role: 'user', text: 'Hello!' });
    expect(result.turnSignals).toHaveLength(1);
    expect(result.turnSignals[0]).toMatchObject({ hintUsed: true, modelAnswerUsed: false });
    expect(createPracticeSessionAction).not.toHaveBeenCalled();
  });

  it('sesion abierta pero sin turnos guardados todavia: no restaura, crea una sesion nueva', async () => {
    (findOpenPracticeSessionAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: { id: 'session-empty', mode: 'conversation', cefr_level: 'b1', seed: null },
    });
    (listPracticeMessagesAction as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, data: [] });
    (createPracticeSessionAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: { id: 'session-new-2', mode: 'conversation' },
    });

    const { resolvePracticeSessionAction } = await import('@/actions/practice/start');
    const result = await resolvePracticeSessionAction(BASE_INPUT);

    expect(result.resumed).toBe(false);
    expect(result.sessionId).toBe('session-new-2');
  });

  it('el repositorio degradado (tablas sin migrar) no rompe: arranca sesion nueva sin sessionId', async () => {
    (findOpenPracticeSessionAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      code: 'degraded',
      degraded: true,
    });
    (createPracticeSessionAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      code: 'degraded',
      degraded: true,
    });

    const { resolvePracticeSessionAction } = await import('@/actions/practice/start');
    const result = await resolvePracticeSessionAction(BASE_INPUT);

    expect(result.resumed).toBe(false);
    expect(result.degraded).toBe(true);
    expect(result.sessionId).toBeNull();
    expect(result.messages).toEqual([]);
  });
});
