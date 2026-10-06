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
vi.mock('@/lib/gemini-client', () => ({ callGemini: (...a: unknown[]) => callGemini(...(a as [])), isOk: () => false }));
vi.mock('@/actions/gemini', () => ({ generateSpeechAction: (...a: unknown[]) => generateSpeech(...(a as [])) }));
vi.mock('@/lib/session/lifecycle', () => ({ currentUserId: async () => 'user-1' }));
vi.mock('@/lib/session/complete', () => ({ completeActivity: vi.fn() }));
vi.mock('@/lib/prompts/db-prompts', () => ({ getPrompt: vi.fn(async () => 'framing') }));

import { generateKETMatchQuestionAction } from '@/actions/modes/ket-reading-part2';

function groupOf(plan: unknown) {
  return { ok: true, data: { kind: 'group', group: { id: 'g1', metadata: { plan } }, items: [] } };
}

const MATCH_PLAN = {
  topic: 'trips',
  texts: [
    { label: 'A', author: 'Emma', text: 'museum' },
    { label: 'B', author: 'Jake', text: 'zoo' },
    { label: 'C', author: 'Sophie', text: 'farm' },
  ],
  questions: [{ number: 1, text: 'Who saw animals?', answer: 'B' }],
};

beforeEach(() => vi.clearAllMocks());

describe('KET reading part 2 opens from the bank', () => {
  it('returns the banked plan with its group id and never calls Gemini or TTS', async () => {
    pickContent.mockResolvedValue(groupOf({ ...MATCH_PLAN, questions: Array.from({ length: 6 }, (_, i) => ({ number: i + 1, text: `q${i}`, answer: 'A' })) }));
    const result = await generateKETMatchQuestionAction();
    expect(result).toMatchObject({ ok: true, data: { framing_text: 'framing', exercise: { bank_group_id: 'g1', topic: 'trips' } } });
    expect(pickContent).toHaveBeenCalledWith(expect.objectContaining({ framework: 'ket', cefr: 'a2', examPart: 'ket_reading_part2', groupsOnly: true, itemless: true }));
    expect(callGemini).not.toHaveBeenCalled();
    expect(generateSpeech).not.toHaveBeenCalled();
  });

  it('returns no_content with an empty bank', async () => {
    pickContent.mockResolvedValue({ ok: false, code: 'no_content', retryable: false });
    expect(await generateKETMatchQuestionAction()).toMatchObject({ ok: false, code: 'no_content' });
    expect(callGemini).not.toHaveBeenCalled();
  });

  it('returns no_content when the stored plan does not match the contract', async () => {
    pickContent.mockResolvedValue(groupOf({ topic: 'x' }));
    expect(await generateKETMatchQuestionAction()).toMatchObject({ ok: false, code: 'no_content' });
  });
});
