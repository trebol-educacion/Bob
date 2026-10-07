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
vi.mock('@/lib/cache', () => ({ getOrCreateCachedContent: vi.fn() }));
vi.mock('next/server', () => ({ after: vi.fn() }));

import { generateA2SessionAction } from '@/actions/modes/a2';
import { generateKETHobbyTalkPlanAction } from '@/actions/modes/ket-speaking-part2';
import { generateKETPictureDescPlanAction } from '@/actions/modes/ket-speaking-part3';
import { HOBBY_PLAN_KIND, HobbyPlanSchema, PICTURE_PLAN_KIND, PicturePlanSchema, restoreKetSpeaking } from '@/lib/speaking/ket-speaking';

const CASES = [
  {
    name: 'part 1 interview',
    part: 'ket_part1',
    open: () => generateA2SessionAction(),
    plan: {
      phase1_questions: ['a', 'b', 'c'],
      topic1: 'School',
      topic1_questions: ['1', '2', '3', '4'],
      topic2: 'Free time',
      topic2_questions: ['5', '6', '7'],
      final_question: 'Tell me about your best friend.',
    },
    expected: { topic1: 'School', exam_part: 'ket_part1', bank_group_id: 'g1' },
  },
  {
    name: 'part 2 hobby talk',
    part: 'ket_part2',
    open: () => generateKETHobbyTalkPlanAction(),
    plan: {
      hobby: 'drawing',
      instruction: 'Tell me about drawing.',
      bullet_points: ['why', 'when'],
      image_prompt: 'p',
      image_url: 'https://img/h.jpg',
      instruction_audio_url: 'https://audio/h.mp3',
    },
    expected: { hobby: 'drawing', image_url: 'https://img/h.jpg', instruction_audio_url: 'https://audio/h.mp3', bank_group_id: 'g1' },
  },
  {
    name: 'part 3 describe the picture',
    part: 'ket_part3',
    open: () => generateKETPictureDescPlanAction(),
    plan: {
      scene_description: 'kids play',
      instruction: 'Describe the picture.',
      image_prompt: 'p',
      image_url: 'https://img/p.jpg',
      instruction_audio_url: 'https://audio/p.mp3',
    },
    expected: { scene_description: 'kids play', image_url: 'https://img/p.jpg', instruction_audio_url: 'https://audio/p.mp3', bank_group_id: 'g1' },
  },
];

function groupOf(plan: unknown) {
  return { ok: true, data: { kind: 'group', group: { id: 'g1', metadata: { plan } }, items: [] } };
}

beforeEach(() => vi.clearAllMocks());

describe.each(CASES)('KET speaking $name opens from the bank', ({ part, open, plan, expected }) => {
  it('returns the banked plan stamped with its group and never calls Gemini, TTS or images', async () => {
    pickContent.mockResolvedValue(groupOf(plan));
    expect(await open()).toMatchObject({ ok: true, data: expected });
    expect(pickContent).toHaveBeenCalledWith(
      expect.objectContaining({ framework: 'ket', cefr: 'a2', examPart: part, skill: 'speaking', groupsOnly: true, itemless: true }),
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

describe('restoring a persisted KET speaking plan keeps its media URLs', () => {
  it('restores the hobby plan with image and audio URLs and its bank stamp', () => {
    const json = { kind: HOBBY_PLAN_KIND, ...CASES[1].plan, exam_part: 'ket_part2', bank_group_id: 'g1' };
    const restored = restoreKetSpeaking([{ role: 'bob', msg_type: 'text', content_json: json }], HOBBY_PLAN_KIND, HobbyPlanSchema);
    expect(restored?.plan).toMatchObject({ image_url: 'https://img/h.jpg', instruction_audio_url: 'https://audio/h.mp3', bank_group_id: 'g1' });
  });

  it('restores the picture plan with image and audio URLs', () => {
    const json = { kind: PICTURE_PLAN_KIND, ...CASES[2].plan };
    const restored = restoreKetSpeaking([{ role: 'bob', msg_type: 'text', content_json: json }], PICTURE_PLAN_KIND, PicturePlanSchema);
    expect(restored?.plan).toMatchObject({ image_url: 'https://img/p.jpg', instruction_audio_url: 'https://audio/p.mp3' });
  });
});
