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
import { getBuildSentenceItemsAction } from '@/actions/modes/writing-build-sentence';
import { getEmailTaskAction } from '@/actions/modes/writing-email';
import { getAcademicTaskAction } from '@/actions/modes/writing-academic';

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

const BUILD_PLAN = {
  items: Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    structure: 'passive',
    tokens: ['was', 'The', 'built', 'house', 'in', '1990', '.'],
    correct_sentence: 'The house was built in 1990.',
    explanation: 'Passive voice.',
  })),
};

const EMAIL_PLAN = { scenario: 'You missed a class.', recipient: 'Professor Miller', purpose: 'ask for notes' };

const ACADEMIC_PLAN = {
  professor_post: { name: 'Dr. Lee', text: 'Should universities offer more online classes?' },
  peer_posts: [
    { name: 'Ana', text: 'Yes, flexibility matters.' },
    { name: 'Tom', text: 'No, campus life matters.' },
  ],
  writing_prompt: 'Add your contribution (minimum 100 words).',
};

describe('TOEFL writing activities open from the bank', () => {
  it('Build a Sentence returns stable item ids per group and never calls Gemini', async () => {
    pickContent.mockResolvedValue(groupOf(BUILD_PLAN));
    const result = await getBuildSentenceItemsAction();
    expect(result).toMatchObject({ ok: true, data: { bankGroupId: 'g1' } });
    if (result.ok) {
      expect(result.data.items).toHaveLength(10);
      expect(result.data.items[0]).toMatchObject({ id: 'g1-1', target_sentence: 'The house was built in 1990.' });
    }
    expect(callGemini).not.toHaveBeenCalled();
  });

  it('Email and Academic Discussion return the banked task', async () => {
    pickContent.mockResolvedValue(groupOf(EMAIL_PLAN));
    expect(await getEmailTaskAction()).toMatchObject({ ok: true, data: { bankGroupId: 'g1', task: { recipient: 'Professor Miller' } } });
    pickContent.mockResolvedValue(groupOf(ACADEMIC_PLAN));
    const academic = await getAcademicTaskAction();
    expect(academic).toMatchObject({ ok: true, data: { instructions: ACADEMIC_PLAN.writing_prompt } });
    expect(callGemini).not.toHaveBeenCalled();
  });

  it('all three return no_content with an empty bank', async () => {
    pickContent.mockResolvedValue({ ok: false, code: 'no_content', retryable: false });
    expect(await getBuildSentenceItemsAction()).toMatchObject({ ok: false, code: 'no_content' });
    expect(await getEmailTaskAction()).toMatchObject({ ok: false, code: 'no_content' });
    expect(await getAcademicTaskAction()).toMatchObject({ ok: false, code: 'no_content' });
  });

  it('reopens an open-writing session with the stored task', async () => {
    const { restoreOpenWriting } = await import('@/lib/writing/open-writing-restore');
    const restored = restoreOpenWriting([
      { role: 'bob', msg_type: 'text', content_json: { kind: 'writing_prompt', instructions: 'write', task: EMAIL_PLAN } },
      { role: 'user', msg_type: 'text', content_json: { kind: 'writing_submission', text: 'hello' } },
      { role: 'bob', msg_type: 'evaluation', content_json: { is_final: true, understood: true, highlights: [], suggestions: [], indicators: { word_count: 1 } } },
    ]);
    expect(restored).toMatchObject({ instructions: 'write', task: EMAIL_PLAN, text: 'hello' });
  });
});
