vi.mock('server-only', () => ({}));

vi.mock('@/actions/practice/repository', () => ({
  createPracticeSessionAction: vi.fn(),
  addPracticeTurnAction: vi.fn().mockResolvedValue({ ok: true, data: null }),
  findOpenPracticeSessionAction: vi.fn(),
  listPracticeMessagesAction: vi.fn(),
}));

vi.mock('@/actions/practice/turn', () => ({
  generatePracticeInitialTurnAction: vi.fn(),
}));

import {
  createPracticeSessionAction,
  findOpenPracticeSessionAction,
  listPracticeMessagesAction,
} from '@/actions/practice/repository';
import { generatePracticeInitialTurnAction } from '@/actions/practice/turn';

const BASE_INPUT = {
  mode: 'conversation' as const,
  skillLevels: null,
  cefrActiveLevel: null,
  organizationId: 'org-1',
};

describe('startPracticeAction — arranque y reanudacion (P2.2, P2.6)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('sin sesion abierta: crea una sesion nueva y pide el primer turno a Gemini', async () => {
    (findOpenPracticeSessionAction as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, data: null });
    (createPracticeSessionAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: { id: 'session-new', mode: 'conversation' },
    });
    (generatePracticeInitialTurnAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      framing: 'framing',
      message: 'Hello!',
    });

    const { startPracticeAction } = await import('@/actions/practice/start');
    const result = await startPracticeAction(BASE_INPUT);

    expect(result.resumed).toBe(false);
    expect(result.sessionId).toBe('session-new');
    expect(result.messages).toEqual([{ role: 'model', text: 'Hello!' }]);
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

    const { startPracticeAction } = await import('@/actions/practice/start');
    const result = await startPracticeAction(BASE_INPUT);

    expect(result.resumed).toBe(true);
    expect(result.sessionId).toBe('session-open');
    expect(result.mode).toBe('situation');
    expect(result.messages).toHaveLength(3);
    expect(result.messages[0]).toEqual({ role: 'model', text: 'Hi there!' });
    expect(result.messages[1]).toEqual({ role: 'user', text: 'Hello!' });
    expect(result.turnSignals).toHaveLength(1);
    expect(result.turnSignals[0]).toMatchObject({ hintUsed: true, modelAnswerUsed: false });
    expect(createPracticeSessionAction).not.toHaveBeenCalled();
    expect(generatePracticeInitialTurnAction).not.toHaveBeenCalled();
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
    (generatePracticeInitialTurnAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      framing: 'framing',
      message: 'Hello again!',
    });

    const { startPracticeAction } = await import('@/actions/practice/start');
    const result = await startPracticeAction(BASE_INPUT);

    expect(result.resumed).toBe(false);
    expect(result.sessionId).toBe('session-new-2');
  });

  it('el repositorio degradado (tablas sin migrar) no rompe: arranca sesion nueva sin error visible', async () => {
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
    (generatePracticeInitialTurnAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      framing: 'framing',
      message: 'Hello!',
    });

    const { startPracticeAction } = await import('@/actions/practice/start');
    const result = await startPracticeAction(BASE_INPUT);

    expect(result.resumed).toBe(false);
    expect(result.degraded).toBe(true);
    expect(result.sessionId).toBeNull();
    expect(result.messages).toEqual([{ role: 'model', text: 'Hello!' }]);
  });
});
