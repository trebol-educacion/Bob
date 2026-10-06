import { describe, it, expect, vi, beforeEach } from 'vitest';

const ensureMock = vi.fn();
const recordMock = vi.fn();
const finishMock = vi.fn();
const userMock = vi.fn();

vi.mock('@/lib/session/lifecycle', () => ({
  ensureSession: (...a: unknown[]) => ensureMock(...a),
  recordTurn: (...a: unknown[]) => recordMock(...a),
  finishSession: (...a: unknown[]) => finishMock(...a),
  currentUserId: () => userMock(),
}));

import { openGenericSessionAction, recordGenericTurnAction, finishGenericSessionAction } from '@/actions/generic-session';
import { buildPracticeSummary, isPracticeSummary } from '@/lib/session/practice-summary';
import { toScore10 } from '@/lib/session/score';
import { deriveChatHistory } from '@/hooks/practice-chat/history';
import { restoreMessages } from '@/hooks/practice-chat/render';
import { mapStoredMessagesToConversation } from '@/lib/conversation/restore';
import type { StoredMessage } from '@/actions/messages';

function stored(overrides: Partial<StoredMessage>): StoredMessage {
  return {
    id: Math.random().toString(36).slice(2),
    session_id: 's1',
    user_id: 'u1',
    role: 'bob',
    msg_type: 'text',
    content_text: null,
    content_json: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  ensureMock.mockReset().mockResolvedValue({ ok: true, data: { sessionId: 's1', userId: 'u1', created: true } });
  recordMock.mockReset().mockResolvedValue({ ok: true, data: { ids: ['a'] } });
  finishMock.mockReset().mockResolvedValue({ ok: true, data: { score10: 8, messageId: 'm' } });
  userMock.mockReset().mockResolvedValue('u1');
});

describe('generic session actions', () => {
  it('abre la sesión con ensureSession y el título del tema', async () => {
    const result = await openGenericSessionAction({ mode: 'generic_conversation', topic: 'cats', title: 'cats' });
    expect(ensureMock).toHaveBeenCalledWith({ mode: 'generic_conversation', topic: 'cats', title: 'cats' });
    expect(result).toEqual({ ok: true, data: { sessionId: 's1' } });
  });

  it('propaga placement_required', async () => {
    ensureMock.mockResolvedValue({ ok: false, code: 'placement_required', retryable: false });
    expect((await openGenericSessionAction({ mode: 'generic_situation', topic: 't', title: 't' })).ok).toBe(false);
  });

  it('registra turnos con await y exige usuario', async () => {
    await recordGenericTurnAction({ sessionId: 's1', messages: [{ role: 'user', msgType: 'text', contentText: 'hi' }] });
    expect(recordMock).toHaveBeenCalledWith({ sessionId: 's1', userId: 'u1', messages: [{ role: 'user', msgType: 'text', contentText: 'hi' }] });
    userMock.mockResolvedValue(null);
    expect((await recordGenericTurnAction({ sessionId: 's1', messages: [] })).ok).toBe(false);
  });

  it('cierra con el resumen y devuelve la nota', async () => {
    const result = await finishGenericSessionAction({ sessionId: 's1', scores: [80, 60] });
    expect(finishMock.mock.calls[0][0].evaluation).toMatchObject({ kind: 'practice_summary', score: 70, score_max: 100 });
    expect(result).toEqual({ ok: true, data: { score10: 8 } });
  });
});

describe('buildPracticeSummary', () => {
  it('promedia a nota 0-10 con toScore10', () => {
    expect(toScore10(buildPracticeSummary([90, 70]))).toBe(8);
  });

  it('sin puntuaciones deja la nota nula', () => {
    expect(toScore10(buildPracticeSummary([]))).toBeNull();
    expect(isPracticeSummary(buildPracticeSummary([]))).toBe(true);
  });
});

describe('restauración de práctica', () => {
  const summary = stored({ msg_type: 'evaluation', content_json: buildPracticeSummary([80]) });
  const phraseEval = stored({ msg_type: 'evaluation', content_json: { score: 80, feedback: 'ok' } });

  it('situation: el resumen cierra la sesión y no cuenta como frase', () => {
    const plan = stored({ msg_type: 'phrase_plan', content_json: { phrases: ['a', 'b', 'c'] } });
    const history = deriveChatHistory('situation', [plan, phraseEval, summary]);
    expect(history.phase).toBe('finished');
    expect(history.closed).toBe(true);
    expect(history.phraseScores).toEqual([80]);
    expect(history.currentIndex).toBe(0);
  });

  it('image: la última evaluación decide la fase aunque exista resumen', () => {
    const scene = stored({ msg_type: 'image_scene', content_text: 'u', content_json: { description: 'd' } });
    const history = deriveChatHistory('image', [scene, phraseEval, summary]);
    expect(history.phase).toBe('result');
    expect(history.closed).toBe(true);
  });

  it('el resumen no se pinta como mensaje', () => {
    expect(restoreMessages([phraseEval, summary])).toHaveLength(1);
  });

  it('conversación: el resumen no entra en el historial', () => {
    const turns = mapStoredMessagesToConversation([stored({ content_text: 'hello' }), summary]);
    expect(turns).toEqual([{ role: 'model', text: 'hello' }]);
  });
});
