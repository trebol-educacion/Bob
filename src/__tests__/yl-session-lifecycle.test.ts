import { describe, it, expect, vi, beforeEach } from 'vitest';

const ensureMock = vi.fn();
const recordMock = vi.fn();
const finishMock = vi.fn();
const userMock = vi.fn();
const updateMock = vi.fn();
const persistMessagesMock = vi.fn();

vi.mock('@/lib/session/lifecycle', () => ({
  ensureSession: (...a: unknown[]) => ensureMock(...a),
  recordTurn: (...a: unknown[]) => recordMock(...a),
  finishSession: (...a: unknown[]) => finishMock(...a),
  currentUserId: () => userMock(),
}));
vi.mock('@/lib/persist-activity', () => ({ persistMessages: (...a: unknown[]) => persistMessagesMock(...a) }));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => ({
    from: () => ({
      update: (values: unknown) => {
        updateMock(values);
        return { eq: () => ({ eq: async () => ({ error: null }) }) };
      },
    }),
  }),
}));
vi.mock('@/lib/gemini-client', () => ({ safeParseFallback: (_s: unknown, v: unknown) => v }));
vi.mock('@/actions/messages', () => ({ getMessagesAction: vi.fn() }));
vi.mock('@/lib/item-bank/content-source', () => ({ pickContent: vi.fn() }));

import { openYLSessionAction } from '@/actions/modes/yl/session';
import { saveYLFinalEvalAction, saveYLTurnAction } from '@/actions/modes/yl/persist';
import { isYLUserTurn } from '@/components/practice/yl/_shared';

const plan = { cues: ['a'], image_prompts: [] };

beforeEach(() => {
  ensureMock.mockReset().mockResolvedValue({ ok: true, data: { sessionId: 's1', userId: 'u1', created: true } });
  recordMock.mockReset().mockResolvedValue({ ok: true, data: { ids: [] } });
  finishMock.mockReset().mockResolvedValue({ ok: true, data: { score10: 7.5, messageId: 'm' } });
  userMock.mockReset().mockResolvedValue('u1');
  updateMock.mockReset();
  persistMessagesMock.mockReset().mockResolvedValue({ ids: ['a', 'b'] });
});

describe('openYLSessionAction', () => {
  it('crea la sesión con ensureSession, guarda el plan y persiste las imágenes', async () => {
    const result = await openYLSessionAction({ mode: 'cambridge_starters_part1', plan, images: ['u0', 'u1'] });
    expect(ensureMock).toHaveBeenCalledWith({ mode: 'cambridge_starters_part1', topic: 'starters_part1' });
    expect(updateMock).toHaveBeenCalledWith({ plan_json: plan });
    const messages = recordMock.mock.calls[0][0].messages;
    expect(messages).toHaveLength(3);
    expect(messages[0]).toMatchObject({ msgType: 'yl_tts', contentJson: { kind: 'yl_plan_stamp', exam_part: 'starters_part1', bank_group_id: null } });
    expect(messages[2].contentJson).toEqual({ image_data_uri: 'u1', image_index: 1 });
    expect(result).toEqual({ ok: true, data: { sessionId: 's1' } });
  });

  it('propaga el fallo de ensureSession sin tocar la BD', async () => {
    ensureMock.mockResolvedValue({ ok: false, code: 'placement_required', retryable: false });
    const result = await openYLSessionAction({ mode: 'cambridge_movers_part2', plan });
    expect(result).toEqual({ ok: false, code: 'placement_required', retryable: false });
    expect(recordMock).not.toHaveBeenCalled();
  });
});

describe('saveYLFinalEvalAction', () => {
  it('cierra con finishSession y devuelve la nota 0-10', async () => {
    const result = await saveYLFinalEvalAction('s1', { score: 3, score_max: 4, cefr_band: 'a1', feedback: 'ok' });
    expect(finishMock.mock.calls[0][0]).toMatchObject({ sessionId: 's1', userId: 'u1', evaluation: { score: 3, score_max: 4 } });
    expect(result).toEqual({ ok: true, data: { score10: 7.5 } });
  });

  it('falla sin usuario autenticado', async () => {
    userMock.mockResolvedValue(null);
    expect((await saveYLFinalEvalAction('s1', { score: 1, score_max: 4, cefr_band: 'a1', feedback: '' })).ok).toBe(false);
  });
});

describe('saveYLTurnAction', () => {
  it('guarda la respuesta como texto con kind yl_turn para sobrevivir al interruptor de voz', async () => {
    await saveYLTurnAction('s1', { cue: 'c', cueIndex: 0, transcript: 'cat', reaction: 'Great' });
    const [user, bob] = persistMessagesMock.mock.calls[0][0];
    expect(user.msgType).toBe('text');
    expect(user.contentJson.kind).toBe('yl_turn');
    expect(bob.msgType).toBe('yl_cue');
  });

  it('reporta fallo reintentable si el insert falla', async () => {
    persistMessagesMock.mockResolvedValue({ error: 'x' });
    expect(await saveYLTurnAction('s1', { cue: 'c', cueIndex: 0, transcript: '', reaction: '' })).toEqual({ ok: false, code: 'persist_failed', retryable: true });
  });
});

describe('isYLUserTurn', () => {
  it('reconoce turnos nuevos y antiguos', () => {
    expect(isYLUserTurn({ role: 'user', msg_type: 'user_audio' })).toBe(true);
    expect(isYLUserTurn({ role: 'user', msg_type: 'text', content_json: { kind: 'yl_turn' } })).toBe(true);
    expect(isYLUserTurn({ role: 'user', msg_type: 'text', content_json: { kind: 'other' } })).toBe(false);
    expect(isYLUserTurn({ role: 'bob', msg_type: 'user_audio' })).toBe(false);
  });
});
