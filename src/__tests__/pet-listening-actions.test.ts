import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const completeMock = vi.fn();
const createSessionMock = vi.fn();
const geminiMock = vi.fn();
const openMock = vi.fn();
const recordMock = vi.fn();
const finishMock = vi.fn();
const readMock = vi.fn();
const closedItemsMock = vi.fn();

vi.mock('@/lib/session/complete', () => ({ completeActivity: (...a: unknown[]) => completeMock(...a) }));
vi.mock('@/lib/session/lifecycle', () => ({
  currentUserId: async () => 'u1',
  openSession: (...a: unknown[]) => openMock(...a),
  recordTurn: (...a: unknown[]) => recordMock(...a),
  finishSession: (...a: unknown[]) => finishMock(...a),
}));
vi.mock('@/lib/persist-activity', () => ({ readSessionMessages: (...a: unknown[]) => readMock(...a) }));
vi.mock('@/actions/sessions', () => ({ createSessionAction: (...a: unknown[]) => createSessionMock(...a) }));
vi.mock('@/lib/prompts/db-prompts', () => ({ getPrompt: vi.fn().mockResolvedValue('prompt') }));
vi.mock('@/actions/gemini', () => ({ generateSpeechAction: vi.fn().mockResolvedValue({ data: 'AUDIO', mimeType: 'audio/x' }) }));
vi.mock('@/lib/gemini-client', () => ({
  callGemini: (...a: unknown[]) => geminiMock(...a),
  isOk: (r: { ok?: boolean }) => r.ok === true,
}));
vi.mock('@/lib/item-bank/content-source', () => ({
  pickContent: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      items: Array.from({ length: 6 }, (_, i) => ({
        id: `i${i}`,
        variant_id: `v${i}`,
        stimulus_audio_url: `/a${i}.mp3`,
        question: 'q',
        options: [{ key: 'A', label: 'a' }, { key: 'B', label: 'b' }],
      })),
    },
  }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => ({
    from: () => ({ select: () => ({ in: (_c: string, ids: string[]) => closedItemsMock(ids) }) }),
  }),
}));

import { generatePETListeningSituationalAction, submitPETListeningSituationalAction } from '@/actions/modes/pet-listening-part1';
import {
  startPETListeningPart2Action,
  submitPETListeningAnswerAction,
  finalizePETListeningSessionAction,
} from '@/actions/modes/pet-listening-part2';
import {
  generatePETListeningGapFillAction,
  generatePETListeningGapFillAudioAction,
  submitPETListeningGapFillAction,
} from '@/actions/modes/pet-listening-part3';
import { generatePETListeningAttitudeAction, submitPETListeningAttitudeAction } from '@/actions/modes/pet-listening-part4';
import {
  generatePETListeningTrueFalseJustifyAction,
  submitPETListeningTrueFalseJustifyAction,
} from '@/actions/modes/pet-listening-part5';
import { tryRestore as restoreP1 } from '@/components/practice/pet/PETListeningSituationalPractice';
import { tryRestore as restoreP2 } from '@/components/practice/pet/PETMultipleChoicePractice';
import { tryRestore as restoreP3 } from '@/components/practice/pet/PETListeningGapFillPractice';
import { tryRestore as restoreP4 } from '@/components/practice/pet/PETListeningAttitudePractice';
import { tryRestore as restoreP5 } from '@/components/practice/pet/PETListeningTrueFalseJustifyPractice';
import type { StoredMessage } from '@/actions/messages';

function geminiJson(payload: unknown) {
  return { ok: true, data: { candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] } };
}

function stored(role: 'bob' | 'user', msgType: string, json: Record<string, unknown>): StoredMessage {
  return { id: 'm', session_id: 's1', user_id: 'u1', role, msg_type: msgType, content_text: null, content_json: json, created_at: '' } as unknown as StoredMessage;
}

function completionMessages(): StoredMessage[] {
  const call = completeMock.mock.calls[0][0];
  return [
    stored('bob', 'text', call.plan),
    ...call.answers.map((a: Record<string, unknown>) => stored('user', 'text', a)),
    stored('bob', 'evaluation', { ...call.evaluation, is_final: true }),
  ];
}

const six = <T>(make: (n: number) => T) => Array.from({ length: 6 }, (_, i) => make(i + 1));

beforeEach(() => {
  completeMock.mockReset().mockResolvedValue({ ok: true, data: { sessionId: 's1', score10: 5 } });
  createSessionMock.mockReset();
  geminiMock.mockReset();
  openMock.mockReset().mockResolvedValue({ ok: true, data: { sessionId: 's1', userId: 'u1' } });
  recordMock.mockReset().mockResolvedValue({ ok: true, data: { ids: [] } });
  finishMock.mockReset().mockResolvedValue({ ok: true, data: { score10: 5, messageId: 'm' } });
  readMock.mockReset();
  closedItemsMock.mockReset();
});

describe('PET Listening Part 1', () => {
  const plan = {
    context: 'c',
    items: six((number) => ({
      number,
      conversation: [{ speaker: 'M', line: 'hi' }, { speaker: 'W', line: 'hello' }],
      question: 'q',
      options: { A: 'a', B: 'b', C: 'c' },
      answer: 'B',
    })),
  };

  it('seals the key, closes once and restores', async () => {
    geminiMock.mockResolvedValue(geminiJson(plan));
    const generated = await generatePETListeningSituationalAction();
    if ('error' in generated) throw new Error(generated.error);
    expect(JSON.stringify(generated)).not.toContain('"answer"');
    expect(createSessionMock).not.toHaveBeenCalled();
    expect(completeMock).not.toHaveBeenCalled();

    const result = await submitPETListeningSituationalAction({
      planToken: generated.planToken,
      answers: { 1: 'B', 2: 'B', 3: 'B', 4: 'A', 5: 'A', 6: 'A' },
    });
    if ('error' in result) throw new Error(result.error);
    expect(result.correct_count).toBe(3);
    expect(completeMock).toHaveBeenCalledTimes(1);
    expect(completeMock.mock.calls[0][0].mode).toBe('cambridge_pet_listening_part1');
    const restored = restoreP1(completionMessages());
    expect(restored?.items).toHaveLength(6);
    expect(restored?.correctCount).toBe(3);
  });

  it('rejects a forged token', async () => {
    expect(await submitPETListeningSituationalAction({ planToken: 'x', answers: {} })).toEqual({ error: 'Could not load exercise' });
    expect(completeMock).not.toHaveBeenCalled();
  });
});

describe('PET Listening Part 3', () => {
  const plan = {
    context: 'c',
    summary_title: 't',
    transcript: 'spoken text',
    summary: 'A [1] B [2] C [3] D [4] E [5] F [6]',
    gaps: six((number) => ({ number, answer: 'cat', accept: [] })),
    word_bank: ['cat', 'dog', 'bird', 'fish', 'cow', 'pig'],
  };

  it('keeps the transcript sealed, synthesizes audio from the token, closes once', async () => {
    geminiMock.mockResolvedValue(geminiJson(plan));
    const generated = await generatePETListeningGapFillAction();
    if ('error' in generated) throw new Error(generated.error);
    expect(JSON.stringify(generated)).not.toContain('spoken text');
    const audio = await generatePETListeningGapFillAudioAction({ planToken: generated.planToken });
    expect(audio.data).toBe('AUDIO');
    const result = await submitPETListeningGapFillAction({
      planToken: generated.planToken,
      answers: { 1: 'cat', 2: 'cat', 3: 'dog', 4: '', 5: 'cat', 6: 'cat' },
    });
    if ('error' in result) throw new Error(result.error);
    expect(result.correct_count).toBe(4);
    expect(completeMock.mock.calls[0][0].mode).toBe('cambridge_pet_listening_part3');
    const restored = restoreP3(completionMessages());
    expect(restored?.correctCount).toBe(4);
  });

  it('returns empty audio for a forged token', async () => {
    expect((await generatePETListeningGapFillAudioAction({ planToken: 'x' })).data).toBe('');
  });
});

describe('PET Listening Part 4', () => {
  const plan = {
    context: 'c',
    items: six((number) => ({ number, monologue: 'm', question: 'q', options: { A: 'a', B: 'b', C: 'c' }, answer: 'C' })),
  };

  it('closes once with the deterministic score and restores', async () => {
    geminiMock.mockResolvedValue(geminiJson(plan));
    const generated = await generatePETListeningAttitudeAction();
    if ('error' in generated) throw new Error(generated.error);
    const result = await submitPETListeningAttitudeAction({
      planToken: generated.planToken,
      answers: { 1: 'C', 2: 'C', 3: 'C', 4: 'C', 5: 'A', 6: 'A' },
    });
    if ('error' in result) throw new Error(result.error);
    expect(result.correct_count).toBe(4);
    expect(completeMock.mock.calls[0][0].mode).toBe('cambridge_pet_listening_part4');
    expect(restoreP4(completionMessages())?.correctCount).toBe(4);
    expect(createSessionMock).not.toHaveBeenCalled();
  });
});

describe('PET Listening Part 5', () => {
  const plan = {
    context: 'c',
    audio: [{ speaker: 'M', line: 'a' }, { speaker: 'W', line: 'b' }],
    statements: six((number) =>
      number % 2
        ? { number, text: 't', is_true: true }
        : { number, text: 't', is_true: false, why_options: { A: 'a', B: 'b' }, why_correct: 'A' },
    ),
  };

  it('scores verdict and justification, closes once and restores', async () => {
    geminiMock.mockResolvedValue(geminiJson(plan));
    const generated = await generatePETListeningTrueFalseJustifyAction();
    if ('error' in generated) throw new Error(generated.error);
    const result = await submitPETListeningTrueFalseJustifyAction({
      planToken: generated.planToken,
      answers: {
        1: { verdict: 'T' },
        2: { verdict: 'F', why: 'A' },
        3: { verdict: 'T' },
        4: { verdict: 'F', why: 'B' },
        5: { verdict: 'F' },
        6: { verdict: 'F', why: 'A' },
      },
    });
    if ('error' in result) throw new Error(result.error);
    expect(result.score).toBe(1 + 2 + 1 + 1 + 0 + 2);
    expect(result.score_max).toBe(9);
    expect(completeMock.mock.calls[0][0].mode).toBe('cambridge_pet_listening_part5');
    expect(restoreP5(completionMessages())).not.toBeNull();
  });
});

describe('PET Listening Part 2', () => {
  const ROWS = Array.from({ length: 6 }, (_, i) => ({
    id: `i${i}`,
    variant_id: `v${i}`,
    stimulus_audio_url: `/a${i}.mp3`,
    question: 'q',
    options: [{ key: 'A', label: 'a' }, { key: 'B', label: 'b' }],
    correct_key: 'B',
  }));
  const ids = ROWS.map((r) => r.id);

  it('start does not create a session', async () => {
    const result = await startPETListeningPart2Action();
    if ('error' in result) throw new Error(result.error);
    expect(result.items).toHaveLength(6);
    expect(JSON.stringify(result)).not.toContain('correct_key');
    expect(openMock).not.toHaveBeenCalled();
  });

  it('first answer opens the session with the plan rebuilt server-side and records one awaited turn', async () => {
    closedItemsMock.mockResolvedValue({ data: ROWS, error: null });
    const result = await submitPETListeningAnswerAction({ itemIds: ids, itemId: 'i0', selectedKey: 'B' });
    if ('error' in result) throw new Error(result.error);
    expect(result).toEqual({ sessionId: 's1', correct: true, correct_key: 'B' });
    const opening = openMock.mock.calls[0][0].opening[0].contentJson;
    expect(opening.kind).toBe('pet_listening_part2_plan');
    expect(opening.items.map((i: { id: string }) => i.id)).toEqual(ids);
    expect(recordMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an item that is not part of the plan', async () => {
    const result = await submitPETListeningAnswerAction({ itemIds: ids, itemId: 'zzz', selectedKey: 'B' });
    expect(result).toEqual({ error: 'Item not found' });
    expect(openMock).not.toHaveBeenCalled();
  });

  it('finalize counts correct turns from the stored history and closes', async () => {
    readMock.mockResolvedValue(
      ids.map((id, i) => ({ content_json: { kind: 'pet_listening_turn_result', item_id: id, correct: i < 4 } })),
    );
    const result = await finalizePETListeningSessionAction({ sessionId: 's1' });
    expect(result).toEqual({ score: 4, score_max: 6 });
    expect(finishMock.mock.calls[0][0].evaluation).toEqual({ kind: 'pet_listening_final', score: 4, score_max: 6 });
  });

  it('restores turns and final score from the history', () => {
    const planMsg = stored('bob', 'text', {
      kind: 'pet_listening_part2_plan',
      items: ROWS,
    });
    const turn = stored('bob', 'evaluation', {
      kind: 'pet_listening_turn_result',
      item_id: 'i0',
      selected_key: 'B',
      correct_key: 'B',
      correct: true,
      is_final: false,
    });
    const final = stored('bob', 'evaluation', { kind: 'pet_listening_final', score: 1, score_max: 6, is_final: true });
    const restored = restoreP2([planMsg, turn, final]);
    expect(restored?.items).toHaveLength(6);
    expect(restored?.turns).toHaveLength(1);
    expect(restored?.finalScore).toBe(1);
  });
});
