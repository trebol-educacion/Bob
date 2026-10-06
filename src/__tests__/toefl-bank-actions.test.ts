import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const pickContent = vi.fn();
const callGemini = vi.fn(() => {
  throw new Error('Gemini must not be called when opening an activity');
});
const generateSpeech = vi.fn(() => {
  throw new Error('TTS must not be called when opening an activity');
});

vi.mock('@/lib/item-bank/content-source', () => ({ pickContent: (...a: unknown[]) => pickContent(...a) }));
vi.mock('@/lib/gemini-client', () => ({ callGemini: (...a: unknown[]) => callGemini(...(a as [])) }));
vi.mock('@/actions/gemini', () => ({ generateSpeechAction: (...a: unknown[]) => generateSpeech(...(a as [])) }));
vi.mock('@/lib/session/lifecycle', () => ({
  currentUserId: async () => 'u1',
  openSession: vi.fn(),
  recordTurn: vi.fn(),
  finishSession: vi.fn(),
}));
vi.mock('@/lib/persist-activity', () => ({ readSessionMessages: vi.fn() }));
vi.mock('@/lib/prompts/db-prompts', () => ({ getPrompt: vi.fn(async () => 'framing') }));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServer: vi.fn() }));
vi.mock('@/lib/session/complete', () => ({ completeActivity: vi.fn() }));

import { generateToeflRepeatSessionAction } from '@/actions/modes/toefl_repeat';
import { generateToeflInterviewAction } from '@/actions/modes/toefl_interview';

function groupOf(plan: unknown) {
  return { ok: true, data: { kind: 'group', group: { id: 'g1', metadata: { plan } }, items: [] } };
}

const REPEAT_PLAN = {
  items: Array.from({ length: 7 }, (_, i) => ({ text: `Sentence ${i}.`, difficulty: Math.min(5, i + 1), audio_url: `https://x/s${i}.mp3` })),
};

const INTERVIEW_PLAN = {
  topic: 'Technology and daily life',
  avatar_intro: 'Let us talk about technology.',
  questions: ['One?', 'Two?', 'Three?', 'Four?'],
  intro_audio_url: 'https://x/intro.mp3',
  question_audio_urls: ['https://x/q1.mp3', 'https://x/q2.mp3', 'https://x/q3.mp3', 'https://x/q4.mp3'],
};

beforeEach(() => vi.clearAllMocks());

describe('TOEFL Listen and Repeat opens from the bank', () => {
  it('returns the banked items with audio URLs and never calls Gemini or TTS', async () => {
    pickContent.mockResolvedValue(groupOf(REPEAT_PLAN));
    const result = await generateToeflRepeatSessionAction();
    expect(result).toMatchObject({ ok: true, data: { bankGroupId: 'g1' } });
    if (result.ok) expect(result.data.items[0].audio_url).toBe('https://x/s0.mp3');
    expect(pickContent).toHaveBeenCalledWith(expect.objectContaining({ framework: 'toefl', examPart: 'toefl_listen_repeat', groupsOnly: true, itemless: true }));
    expect(callGemini).not.toHaveBeenCalled();
    expect(generateSpeech).not.toHaveBeenCalled();
  });

  it('returns no_content with an empty bank and for a stored plan without audio', async () => {
    pickContent.mockResolvedValue({ ok: false, code: 'no_content', retryable: false });
    expect(await generateToeflRepeatSessionAction()).toMatchObject({ ok: false, code: 'no_content' });
    pickContent.mockResolvedValue(groupOf({ items: [{ text: 'a', difficulty: 1 }] }));
    expect(await generateToeflRepeatSessionAction()).toMatchObject({ ok: false, code: 'no_content' });
    expect(callGemini).not.toHaveBeenCalled();
  });
});

describe('TOEFL Interview opens from the bank', () => {
  it('maps the banked set to the interview plan with audio and group id', async () => {
    pickContent.mockResolvedValue(groupOf(INTERVIEW_PLAN));
    const result = await generateToeflInterviewAction();
    expect(result).toMatchObject({ ok: true, data: { topic_name: 'Technology and daily life', bank_group_id: 'g1', intro_audio_url: 'https://x/intro.mp3' } });
    if (result.ok) {
      expect(result.data.questions).toHaveLength(4);
      expect(result.data.questions[2]).toMatchObject({ text: 'Three?', difficulty: 3, audio_url: 'https://x/q3.mp3' });
    }
    expect(callGemini).not.toHaveBeenCalled();
    expect(generateSpeech).not.toHaveBeenCalled();
  });

  it('returns no_content with an empty bank', async () => {
    pickContent.mockResolvedValue({ ok: false, code: 'no_content', retryable: false });
    expect(await generateToeflInterviewAction()).toMatchObject({ ok: false, code: 'no_content' });
  });
});

describe('restoration keeps the banked audio', () => {
  it('reopens a repeat session with the stored audio URLs', async () => {
    const { restoreRepeat } = await import('@/lib/toefl/repeat');
    const restored = restoreRepeat([{ role: 'bob', msg_type: 'phrase', content_json: { phrases: REPEAT_PLAN.items, exam_part: 'toefl_listen_repeat', bank_group_id: 'g1' } }]);
    expect(restored?.items[0].audio_url).toBe('https://x/s0.mp3');
  });

  it('reopens an interview session with the stored plan and group id', async () => {
    const { restoreInterview } = await import('@/lib/toefl/interview');
    const { toInterviewPlan } = await import('@/lib/toefl/interview-bank');
    const plan = toInterviewPlan(INTERVIEW_PLAN, 'g1');
    const restored = restoreInterview([{ role: 'bob', msg_type: 'phrase', content_json: { ...plan, exam_part: 'toefl_interview' } }]);
    expect(restored?.plan.questions[0].audio_url).toBe('https://x/q1.mp3');
    expect(restored?.plan.bank_group_id).toBe('g1');
  });
});
