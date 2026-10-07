import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gradeListenMatch, gradeShortConversations, listenMatchTranscript } from '@/lib/ket/listening-grading';
import { toPublicShortConversations, type KetShortConversationsPlan } from '@/lib/bank-plans/ket-listening-part4';
import { toPublicListenMatch, type KetListenMatchPlan } from '@/lib/bank-plans/ket-listening-part5';

vi.mock('server-only', () => ({}));

const completeMock = vi.fn();
const loadPlanMock = vi.fn();

vi.mock('@/lib/session/complete', () => ({ completeActivity: (...a: unknown[]) => completeMock(...a) }));
vi.mock('@/lib/session/lifecycle', () => ({ currentUserId: async () => 'user-1' }));
vi.mock('@/lib/prompts/db-prompts', () => ({ getPrompt: vi.fn(async () => 'framing') }));
vi.mock('@/lib/item-bank/plan-bank', async (original) => ({
  ...(await original<typeof import('@/lib/item-bank/plan-bank')>()),
  loadPlan: (...a: unknown[]) => loadPlanMock(...a),
}));

import { submitKETShortConversationsAction } from '@/actions/modes/ket-listening-part4';
import { submitKETListenMatchAction } from '@/actions/modes/ket-listening-part5';

const URL = 'https://cdn/a.mp3';
const DIALOGUE = [
  { speaker: 'W' as const, line: 'Shall we take the bus?' },
  { speaker: 'M' as const, line: 'No, let us walk.' },
];

const SHORT: KetShortConversationsPlan = {
  items: [1, 2, 3, 4, 5].map((n) => ({
    number: n,
    context: `c${n}`,
    dialogue: DIALOGUE,
    question: 'How will they go?',
    options: { A: 'bus', B: 'walk', C: 'car' },
    answer: 'B' as const,
    audio_url: URL,
  })),
};

const KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
const MATCH: KetListenMatchPlan = {
  instruction: 'What present does each person get?',
  conversation: [...DIALOGUE, ...DIALOGUE, ...DIALOGUE],
  people: [1, 2, 3, 4, 5].map((n) => ({ number: n, name: `P${n}`, answer: KEYS[n - 1] })),
  options: KEYS.map((key) => ({ key, text: `gift ${key}` })),
  audio_url: URL,
};

beforeEach(() => {
  vi.clearAllMocks();
  completeMock.mockResolvedValue({ ok: true, data: { sessionId: 's-1' } });
});

describe('grading', () => {
  it('short conversations: compares with the key and keeps the transcript', () => {
    const results = gradeShortConversations(SHORT, { 1: 'B', 2: 'A' });
    expect(results.map((r) => r.is_correct)).toEqual([true, false, false, false, false]);
    expect(results[0].transcript).toContain('Woman: Shall we take the bus?');
  });

  it('listen and match: one result per person', () => {
    const results = gradeListenMatch(MATCH, { 1: 'A', 2: 'C' });
    expect(results.map((r) => r.is_correct)).toEqual([true, false, false, false, false]);
    expect(listenMatchTranscript(MATCH)).toContain('Man: No, let us walk.');
  });

  it('public plans carry no keys or transcripts', () => {
    const shortPublic = JSON.stringify(toPublicShortConversations(SHORT));
    expect(shortPublic).not.toContain('"answer"');
    expect(shortPublic).not.toContain('dialogue');
    const matchPublic = JSON.stringify(toPublicListenMatch(MATCH));
    expect(matchPublic).not.toContain('"answer"');
    expect(matchPublic).not.toContain('conversation');
  });
});

describe('submit actions', () => {
  it('short conversations grade with the bank keys and close once', async () => {
    loadPlanMock.mockResolvedValue({ ok: true, data: SHORT });
    const exercise = { items: toPublicShortConversations(SHORT), bank_group_id: 'g-4' };
    const result = await submitKETShortConversationsAction({ framing_text: 'f', exercise, answers: { 1: 'B', 2: 'B' } });
    expect(result).toMatchObject({ ok: true, data: { correct_count: 2, total: 5 } });
    const call = completeMock.mock.calls[0][0];
    expect(call.mode).toBe('cambridge_ket_listening_part4');
    expect(call.bank).toEqual({ exam_part: 'ket_listening_part4', bank_group_id: 'g-4' });
    expect(call.evaluation).toMatchObject({ score: 2, score_max: 5, is_final: true });
  });

  it('listen and match grades with the bank keys and stores the transcript', async () => {
    loadPlanMock.mockResolvedValue({ ok: true, data: MATCH });
    const exercise = { ...toPublicListenMatch(MATCH), bank_group_id: 'g-5' };
    const result = await submitKETListenMatchAction({ framing_text: 'f', exercise, answers: { 1: 'A' } });
    expect(result).toMatchObject({ ok: true, data: { correct_count: 1, total: 5 } });
    expect(completeMock.mock.calls[0][0].evaluation.transcript).toContain('Woman:');
  });

  it('fail without closing the session when the plan is gone', async () => {
    loadPlanMock.mockResolvedValue({ ok: false, code: 'no_content', retryable: false });
    const exercise = { ...toPublicListenMatch(MATCH), bank_group_id: 'g-5' };
    expect(await submitKETListenMatchAction({ framing_text: 'f', exercise, answers: {} })).toMatchObject({ ok: false });
    expect(completeMock).not.toHaveBeenCalled();
  });
});
