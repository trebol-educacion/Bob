import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const pickContent = vi.fn();
const callGemini = vi.fn(() => {
  throw new Error('Gemini must not be called when opening an activity');
});
const generateImages = vi.fn(() => {
  throw new Error('Image generation must not be called when opening an activity');
});
const generateSpeech = vi.fn(() => {
  throw new Error('TTS must not be called when opening an activity');
});

vi.mock('@/lib/item-bank/content-source', () => ({ pickContent: (...a: unknown[]) => pickContent(...a) }));
vi.mock('@/lib/gemini-client', () => ({ callGemini: (...a: unknown[]) => callGemini(...(a as [])), isOk: () => false, safeParseFallback: vi.fn() }));
vi.mock('@/actions/gemini', () => ({ generateSpeechAction: (...a: unknown[]) => generateSpeech(...(a as [])) }));
vi.mock('@/actions/modes/yl', () => ({ generateYLImagesParallelAction: (...a: unknown[]) => generateImages(...(a as [])) }));
vi.mock('@/lib/session/lifecycle', () => ({
  currentUserId: async () => 'u1',
  openSession: vi.fn(),
  recordTurn: vi.fn(),
  finishSession: vi.fn(),
}));
vi.mock('@/lib/session/complete', () => ({ completeActivity: vi.fn() }));
vi.mock('@/lib/cache', () => ({ getOrCreateCachedContent: vi.fn() }));
vi.mock('@/lib/prompts/db-prompts', () => ({ getPrompt: vi.fn(async () => 'framing') }));

import { generatePETInterviewAction } from '@/actions/modes/pet-p1';
import { generatePETDiscussionAction } from '@/actions/modes/pet-p4';
import { generatePart3ScenarioAction } from '@/actions/modes/part3';
import { generatePETPictureDescriptionAction } from '@/actions/modes/pet-p2/generate';

function group(plan: unknown) {
  return { ok: true, data: { kind: 'group', group: { id: 'g1', metadata: { plan } }, items: [] } };
}

const NO_CONTENT = { ok: false, code: 'no_content', retryable: false };

const INTERVIEW = {
  phase1_questions: ['Hello?', 'Where are you from?'],
  topicA: 'Studies',
  topicA_questions: ['q1', 'q2'],
  topicA_followup: 'more?',
  topicBC: 'Daily Life',
  topicBC_questions: ['q3', 'q4'],
  topicBC_followup: 'why?',
  closing: 'Bye',
};

const DISCUSSION = { topic: 'Hobbies', link: 'link', questions: ['a', 'b', 'c', 'd', 'e', 'f'], closing: 'Bye' };

const SCENARIO = { topic: 'Trip', situation: 'sit', prompt_question: 'which?', options: ['1', '2', '3', '4', '5'] };

const PICTURE = {
  topic: 'Free Time',
  scene_prompt: 'two friends play football',
  reference_vocabulary: { place: ['park'], people: ['friends'], activity: ['play'], objects: ['ball'], emotions: ['happy'], weather_setting: ['sunny'] },
  language_bank: { openers: ['o'], speculation: ['s'], describing_people: ['d'], linkers: ['l'] },
  image_url: 'https://cdn.example/scene.jpg',
};

beforeEach(() => vi.clearAllMocks());

describe('PET speaking actions open from the bank', () => {
  it('Part 1 returns the banked interview stamped with its group', async () => {
    pickContent.mockResolvedValue(group(INTERVIEW));
    const result = await generatePETInterviewAction();
    expect(result).toMatchObject({ ok: true, data: { topicBC: 'Daily Life', exam_part: 'pet_p1', bank_group_id: 'g1' } });
    expect(pickContent).toHaveBeenCalledWith(expect.objectContaining({ framework: 'pet', cefr: 'b1', examPart: 'pet_p1', skill: 'speaking', groupsOnly: true, itemless: true }));
  });

  it('Part 4 returns the banked discussion stamped with its group', async () => {
    pickContent.mockResolvedValue(group(DISCUSSION));
    expect(await generatePETDiscussionAction()).toMatchObject({ ok: true, data: { exam_part: 'pet_p4', bank_group_id: 'g1' } });
  });

  it('Part 3 returns the banked scenario stamped with its group', async () => {
    pickContent.mockResolvedValue(group(SCENARIO));
    expect(await generatePart3ScenarioAction()).toMatchObject({ ok: true, data: { topic: 'Trip', exam_part: 'pet_p3', bank_group_id: 'g1' } });
  });

  it('Part 2 returns the banked scene with its stored photograph', async () => {
    pickContent.mockResolvedValue(group(PICTURE));
    expect(await generatePETPictureDescriptionAction()).toMatchObject({
      ok: true,
      data: { imageUrl: 'https://cdn.example/scene.jpg', bankGroupId: 'g1', framingText: 'framing' },
    });
  });

  it.each([
    ['Part 1', () => generatePETInterviewAction()],
    ['Part 2', () => generatePETPictureDescriptionAction()],
    ['Part 3', () => generatePart3ScenarioAction()],
    ['Part 4', () => generatePETDiscussionAction()],
  ])('%s returns no_content with an empty bank', async (_label, open) => {
    pickContent.mockResolvedValue(NO_CONTENT);
    expect(await open()).toMatchObject({ ok: false, code: 'no_content' });
  });

  it.each([
    ['Part 1', () => generatePETInterviewAction()],
    ['Part 2', () => generatePETPictureDescriptionAction()],
    ['Part 3', () => generatePart3ScenarioAction()],
    ['Part 4', () => generatePETDiscussionAction()],
  ])('%s rejects a stored plan that breaks the contract', async (_label, open) => {
    pickContent.mockResolvedValue(group({ broken: true }));
    expect(await open()).toMatchObject({ ok: false, code: 'no_content' });
  });

  it('never calls Gemini, image generation or TTS while opening', async () => {
    pickContent.mockResolvedValue(group(PICTURE));
    await generatePETPictureDescriptionAction();
    pickContent.mockResolvedValue(group(INTERVIEW));
    await generatePETInterviewAction();
    expect(callGemini).not.toHaveBeenCalled();
    expect(generateImages).not.toHaveBeenCalled();
    expect(generateSpeech).not.toHaveBeenCalled();
  });
});
