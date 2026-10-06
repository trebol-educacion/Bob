import { describe, it, expect, vi, beforeEach } from 'vitest';

const openMock = vi.fn();
const recordMock = vi.fn();
const finishMock = vi.fn();
const geminiMock = vi.fn();
const readMock = vi.fn();
vi.mock('@/lib/session/lifecycle', () => ({
  currentUserId: async () => 'u1',
  openSession: (...a: unknown[]) => openMock(...a),
  recordTurn: (...a: unknown[]) => recordMock(...a),
  finishSession: (...a: unknown[]) => finishMock(...a),
}));
vi.mock('@/lib/persist-activity', () => ({ readSessionMessages: (...a: unknown[]) => readMock(...a) }));
vi.mock('@/lib/gemini-client', () => ({ callGemini: (...a: unknown[]) => geminiMock(...a) }));
vi.mock('@/lib/prompts/db-prompts', () => ({ getPrompt: async () => 'p' }));
vi.mock('@/lib/cache', () => ({ getOrCreateCachedContent: vi.fn() }));

import { finishToeflRepeatAction, submitRepetitionAction } from '@/actions/modes/toefl_repeat';
import { buildRepeatEvaluation, restoreRepeat } from '@/lib/toefl/repeat';

const items = Array.from({ length: 10 }, (_, i) => ({ text: `sentence ${i}`, difficulty: 1 }));

const evaluation = (index: number, exact: boolean) => ({
  phraseIndex: index,
  kind: 'repetition_objective',
  exact_repetition: exact,
  missing_words: [],
  extra_words: [],
  transcribed_text: 'x',
  original_text: items[index].text,
});

beforeEach(() => {
  openMock.mockReset().mockResolvedValue({ ok: true, data: { sessionId: 's1', userId: 'u1' } });
  recordMock.mockReset().mockResolvedValue({ ok: true, data: { ids: [] } });
  finishMock.mockReset().mockResolvedValue({ ok: true, data: { score10: 3, messageId: 'm' } });
  geminiMock.mockReset();
  readMock.mockReset();
});

describe('restoreRepeat', () => {
  it('keeps the last attempt per phrase and fills gaps with null', () => {
    const restored = restoreRepeat([
      { role: 'bob', msg_type: 'phrase', content_json: { phrases: items } },
      { role: 'bob', msg_type: 'evaluation', content_json: evaluation(0, false) },
      { role: 'bob', msg_type: 'evaluation', content_json: evaluation(0, true) },
    ]);
    expect(restored?.evaluations[0]?.exact_repetition).toBe(true);
    expect(restored?.evaluations[1]).toBeNull();
    expect(restored?.finished).toBe(false);
  });

  it('flags finished sessions and rejects histories without plan', () => {
    const finished = restoreRepeat([
      { role: 'bob', msg_type: 'phrase', content_json: { phrases: items } },
      { role: 'bob', msg_type: 'evaluation', content_json: { kind: 'repeat_evaluation', is_final: true } },
    ]);
    expect(finished?.finished).toBe(true);
    expect(restoreRepeat([])).toBeNull();
  });
});

describe('buildRepeatEvaluation', () => {
  it('grades exact repetitions over the item count', () => {
    const feedbacks = [{ exact_repetition: true }, null, { exact_repetition: false }] as never;
    expect(buildRepeatEvaluation(feedbacks, 10)).toMatchObject({ score: 1, score_max: 10 });
  });
});

describe('submitRepetitionAction', () => {
  const input = { items, phraseIndex: 0, audioBase64: 'x', mimeType: 'audio/webm' };

  it('opens the session with the phrase plan on the first graded attempt', async () => {
    geminiMock.mockResolvedValue({ ok: true, data: { text: JSON.stringify(evaluation(0, true)) } });
    const outcome = await submitRepetitionAction(input);
    expect(openMock).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'toefl_listen_repeat', opening: [expect.objectContaining({ msgType: 'phrase' })] }),
    );
    expect(outcome).toMatchObject({ sessionId: 's1', feedback: { exact_repetition: true } });
  });

  it('creates no session when the evaluation fails', async () => {
    geminiMock.mockResolvedValue({ ok: false, error: 'x' });
    expect(await submitRepetitionAction(input)).toEqual({ error: 'evaluation_failed' });
    expect(openMock).not.toHaveBeenCalled();
  });
});

describe('finishToeflRepeatAction', () => {
  it('closes with hits over the full item count', async () => {
    readMock.mockResolvedValue([
      { role: 'bob', msg_type: 'phrase', content_json: { phrases: items } },
      { role: 'bob', msg_type: 'evaluation', content_json: evaluation(0, true) },
      { role: 'bob', msg_type: 'evaluation', content_json: evaluation(1, true) },
      { role: 'bob', msg_type: 'evaluation', content_json: evaluation(2, false) },
    ]);
    expect(await finishToeflRepeatAction('s1')).toEqual({ score10: 3 });
    expect(finishMock).toHaveBeenCalledWith(expect.objectContaining({ evaluation: expect.objectContaining({ score: 2, score_max: 10 }) }));
  });
});
