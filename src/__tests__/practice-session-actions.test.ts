import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const ensureSessionMock = vi.fn();
const recordTurnMock = vi.fn();
const finishSessionMock = vi.fn();
const currentUserIdMock = vi.fn();
const createSidecarMock = vi.fn();
const closeSidecarMock = vi.fn();
const discardMock = vi.fn();

vi.mock('@/lib/session/lifecycle', () => ({
  ensureSession: (...a: unknown[]) => ensureSessionMock(...a),
  recordTurn: (...a: unknown[]) => recordTurnMock(...a),
  finishSession: (...a: unknown[]) => finishSessionMock(...a),
  currentUserId: () => currentUserIdMock(),
}));
vi.mock('@/lib/practice/sidecar', () => ({
  createPracticeSidecar: (...a: unknown[]) => createSidecarMock(...a),
  closePracticeSidecar: (...a: unknown[]) => closeSidecarMock(...a),
  discardPracticeSession: (...a: unknown[]) => discardMock(...a),
}));

import { recordPracticeTurnAction, type RecordPracticeTurnInput } from '@/actions/practice/turn';
import { finishPracticeAction } from '@/actions/practice/finish';

const SEED = { angle: 'a', character: 'a friend', tone: 'warm', topic: 'a warm chat' };

function input(overrides: Partial<RecordPracticeTurnInput> = {}): RecordPracticeTurnInput {
  return {
    sessionId: null,
    mode: 'conversation',
    level: 'b2',
    seed: SEED,
    organizationId: 'org-1',
    opening: { framing: 'F', message: 'Hello', imageUrl: null, imagePrompt: null },
    student: { text: 'hi', signal: { hasAudio: false, hintUsed: false, modelAnswerUsed: false, turnScore: 80 } },
    botText: 'Nice',
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  ensureSessionMock.mockResolvedValue({ ok: true, data: { sessionId: 's1', userId: 'u1', created: true } });
  recordTurnMock.mockResolvedValue({ ok: true, data: { ids: [] } });
  createSidecarMock.mockResolvedValue({ ok: true, data: null });
  closeSidecarMock.mockResolvedValue({ ok: true, data: null });
  finishSessionMock.mockResolvedValue({ ok: true, data: { score10: 3, messageId: 'm1' } });
  currentUserIdMock.mockResolvedValue('u1');
});

describe('recordPracticeTurnAction', () => {
  it('primer turno: crea la sesion practice_<modo>, el sidecar enlazado y persiste apertura + intercambio con await', async () => {
    const result = await recordPracticeTurnAction(input());

    expect(ensureSessionMock).toHaveBeenCalledWith({ mode: 'practice_conversation', sessionId: null, topic: SEED.topic });
    expect(createSidecarMock).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 's1', mode: 'conversation', level: 'b2', organizationId: 'org-1' }));
    const messages = recordTurnMock.mock.calls[0][0].messages;
    expect(messages.map((m: { role: string }) => m.role)).toEqual(['bob', 'user', 'bob']);
    expect(result).toEqual({ ok: true, data: { sessionId: 's1' } });
  });

  it('turnos siguientes: reutiliza la sesion y solo escribe el intercambio', async () => {
    ensureSessionMock.mockResolvedValue({ ok: true, data: { sessionId: 's1', userId: 'u1', created: false } });
    await recordPracticeTurnAction(input({ sessionId: 's1' }));

    expect(createSidecarMock).not.toHaveBeenCalled();
    expect(recordTurnMock.mock.calls[0][0].messages).toHaveLength(2);
  });

  it('si falla el insert de los mensajes borra la sesion recien creada y devuelve el fallo reintentable', async () => {
    recordTurnMock.mockResolvedValue({ ok: false, code: 'persist_failed', retryable: true });
    const result = await recordPracticeTurnAction(input());

    expect(discardMock).toHaveBeenCalledWith('s1');
    expect(result).toEqual({ ok: false, code: 'persist_failed', retryable: true });
  });

  it('si falla el sidecar tampoco deja una sesion huerfana', async () => {
    createSidecarMock.mockResolvedValue({ ok: false, code: 'practice_sidecar_failed', retryable: true });
    const result = await recordPracticeTurnAction(input());

    expect(discardMock).toHaveBeenCalledWith('s1');
    expect(recordTurnMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });
});

describe('finishPracticeAction', () => {
  const signals = [{ hasAudio: true, hintUsed: false, modelAnswerUsed: false, turnScore: 80 }];

  it('cierra con la nota de la rubrica en sessions.score_10 y sin contar para Progreso', async () => {
    const result = await finishPracticeAction('s1', signals);

    expect(finishSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 's1',
        userId: 'u1',
        countsTowardProgress: false,
        evaluation: expect.objectContaining({ kind: 'practice_result', score_10: result.score }),
      })
    );
    expect(result.persisted).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  it('no cierra la sesion si el sidecar no se pudo actualizar y avisa persisted:false', async () => {
    closeSidecarMock.mockResolvedValue({ ok: false, code: 'practice_sidecar_failed', retryable: true });
    const result = await finishPracticeAction('s1', signals);

    expect(finishSessionMock).not.toHaveBeenCalled();
    expect(result.persisted).toBe(false);
  });

  it('sin sesion (sin turnos) no escribe nada', async () => {
    const result = await finishPracticeAction(null, []);

    expect(finishSessionMock).not.toHaveBeenCalled();
    expect(result.persisted).toBe(true);
  });
});
