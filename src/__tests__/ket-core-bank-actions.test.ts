import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const pickContent = vi.fn();
const callGemini = vi.fn(() => {
  throw new Error('Gemini must not be called when opening an activity');
});
const generateSpeech = vi.fn(() => {
  throw new Error('TTS must not be called when opening an activity');
});
const generateImages = vi.fn(() => {
  throw new Error('Image generation must not be called when opening an activity');
});

vi.mock('@/lib/item-bank/content-source', () => ({ pickContent: (...a: unknown[]) => pickContent(...a) }));
vi.mock('@/lib/gemini-client', () => ({ callGemini: (...a: unknown[]) => callGemini(...(a as [])), isOk: () => false }));
vi.mock('@/actions/gemini', () => ({ generateSpeechAction: (...a: unknown[]) => generateSpeech(...(a as [])) }));
vi.mock('@/actions/modes/yl', () => ({ generateYLImagesParallelAction: (...a: unknown[]) => generateImages(...(a as [])) }));
vi.mock('@/lib/session/lifecycle', () => ({ currentUserId: async () => 'user-1' }));
vi.mock('@/lib/session/complete', () => ({ completeActivity: vi.fn() }));
vi.mock('@/lib/prompts/db-prompts', () => ({ getPrompt: vi.fn(async () => 'framing') }));

import { generateKETSignsAndNoticesAction } from '@/actions/modes/ket-reading-part1';
import { generateKETLongTextAction } from '@/actions/modes/ket-reading-part3';
import { generateKETVocabGapAction } from '@/actions/modes/ket-reading-part4';
import { generateKETReadingTFDSAction } from '@/actions/modes/ket-reading-part5';
import { generateKETShortMessageAction } from '@/actions/modes/ket-writing-part6';
import { generateKETPictureStoryPlanAction } from '@/actions/modes/ket-writing-part7';

const six = <T>(build: (n: number) => T): T[] => Array.from({ length: 6 }, (_, i) => build(i + 1));
const letters = { A: 'a', B: 'b', C: 'c' };

const CASES = [
  {
    name: 'reading part 1',
    part: 'ket_reading_part1',
    skill: 'reading',
    open: () => generateKETSignsAndNoticesAction(),
    plan: {
      items: six((n) => ({
        number: n,
        sign_text: `Sign ${n}`,
        sign_context: 'library',
        question: 'q',
        options: [{ id: 'A', text: 'a' }, { id: 'B', text: 'b' }, { id: 'C', text: 'c' }],
        correct_option: 'A',
        explanation: 'e',
        image_url: 'https://img/x.jpg',
      })),
    },
    expected: { items: expect.any(Array), bankGroupId: 'g1' },
  },
  {
    name: 'reading part 3',
    part: 'ket_reading_part3',
    skill: 'reading',
    open: () => generateKETLongTextAction(),
    plan: { title: 't', text: 'x', items: six((n) => ({ number: n, question: 'q', options: letters, answer: 'B' })) },
    expected: { exercise: { bank_group_id: 'g1', title: 't' } },
  },
  {
    name: 'reading part 4',
    part: 'ket_reading_part4',
    skill: 'reading',
    open: () => generateKETVocabGapAction(),
    plan: { title: 't', text: 'x', items: six((n) => ({ number: n, options: letters, answer: 'C' })) },
    expected: { exercise: { bank_group_id: 'g1', title: 't' } },
  },
  {
    name: 'reading part 5',
    part: 'ket_reading_part5',
    skill: 'reading',
    open: () => generateKETReadingTFDSAction(),
    plan: { title: 't', text: 'x', statements: six((n) => ({ number: n, text: 's', verdict: 'DS' })) },
    expected: { exercise: { bank_group_id: 'g1', title: 't' } },
  },
  {
    name: 'writing part 6',
    part: 'ket_writing_part6',
    skill: 'writing',
    open: () => generateKETShortMessageAction(),
    plan: { scenario: 'sc', recipient: 'a friend', content_points: ['a', 'b', 'c'], word_target: 25 },
    expected: { scenario: 'sc', contentPoints: ['a', 'b', 'c'], bankGroupId: 'g1' },
  },
  {
    name: 'writing part 7',
    part: 'ket_writing_part7',
    skill: 'writing',
    open: () => generateKETPictureStoryPlanAction(),
    plan: {
      story_premise: 'p',
      scenes: [1, 2, 3].map((n) => ({ number: n, description: 'd', image_prompt: 'i', image_url: `https://img/${n}.jpg` })),
    },
    expected: { story_premise: 'p', bank_group_id: 'g1', scenes: [expect.objectContaining({ image_url: 'https://img/1.jpg' }), expect.anything(), expect.anything()] },
  },
];

function groupOf(plan: unknown) {
  return { ok: true, data: { kind: 'group', group: { id: 'g1', metadata: { plan } }, items: [] } };
}

beforeEach(() => vi.clearAllMocks());

describe.each(CASES)('KET $name opens from the bank', ({ part, skill, open, plan, expected }) => {
  it('returns the banked plan and never calls Gemini, TTS or image generation', async () => {
    pickContent.mockResolvedValue(groupOf(plan));
    const result = await open();
    expect(result).toMatchObject({ ok: true, data: expected });
    expect(pickContent).toHaveBeenCalledWith(
      expect.objectContaining({ framework: 'ket', cefr: 'a2', examPart: part, skill, groupsOnly: true, itemless: true }),
    );
    expect(callGemini).not.toHaveBeenCalled();
    expect(generateSpeech).not.toHaveBeenCalled();
    expect(generateImages).not.toHaveBeenCalled();
  });

  it('returns no_content with an empty bank', async () => {
    pickContent.mockResolvedValue({ ok: false, code: 'no_content', retryable: false });
    expect(await open()).toMatchObject({ ok: false, code: 'no_content' });
    expect(callGemini).not.toHaveBeenCalled();
  });

  it('returns no_content when the stored plan breaks the contract', async () => {
    pickContent.mockResolvedValue(groupOf({ broken: true }));
    expect(await open()).toMatchObject({ ok: false, code: 'no_content' });
  });
});
