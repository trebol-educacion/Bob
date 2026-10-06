import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const callGemini = vi.fn(() => {
  throw new Error('Gemini must not be called when opening an activity');
});
const pickContent = vi.fn();

vi.mock('@/lib/gemini-client', () => ({
  callGemini: (...a: unknown[]) => callGemini(...(a as [])),
  streamGemini: () => {
    throw new Error('Gemini must not be called');
  },
  safeParseFallback: (_s: unknown, v: unknown) => v,
  isOk: (r: { ok: boolean }) => r.ok,
}));
vi.mock('@/lib/item-bank/content-source', () => ({ pickContent: (...a: unknown[]) => pickContent(...a) }));
vi.mock('@/lib/prompts/db-prompts', () => ({ getPrompt: async () => 'framing' }));
vi.mock('@/lib/session/lifecycle', () => ({
  currentUserId: async () => 'u1',
  ensureSession: vi.fn(),
  openSession: vi.fn(),
  recordTurn: vi.fn(),
  finishSession: vi.fn(),
}));
vi.mock('@/actions/item-bank/repository', () => ({ fetchGroups: vi.fn(), fetchGroupItems: vi.fn() }));
vi.mock('@/lib/speaking/linked-topic', () => ({ readRecentSessionTopic: async () => 'Museums' }));
vi.mock('@/lib/speaking/question-round', () => ({
  evaluateQuestionRound: vi.fn(),
  processQuestionRoundAnswer: vi.fn(),
}));

import { generateFCEClozeAction } from '@/actions/modes/fce-reading-part1';
import { generateFCEEssayAction } from '@/actions/modes/fce-writing-part1';
import { generateFCEInterviewAction } from '@/actions/modes/fce-p1';
import { generateFCEDiscussionAction } from '@/actions/modes/fce-p4';
import { generateFCEPictureDescriptionAction } from '@/actions/modes/fce-p2/generate';

const group = (metadata: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  kind: 'group',
  group: { id: 'g1', stimulus_text: null, metadata, ...extra },
  items: [] as unknown[],
});

const cloze = {
  kind: 'group',
  group: { id: 'g1', stimulus_text: 'Text ___1___', metadata: { title: 'T' } },
  items: [
    {
      group_order: 1,
      metadata: { number: 1 },
      options: ['A', 'B', 'C', 'D'].map((key) => ({ key, label: `o${key}` })),
      correct_key: 'C',
      explanation: 'because',
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('actions that open FCE activities read the bank and never call Gemini', () => {
  it('R1 cloze', async () => {
    pickContent.mockResolvedValue({ ok: true, data: cloze });
    const result = await generateFCEClozeAction();
    expect(result.ok && result.data.gaps[0]).toEqual({
      number: 1,
      options: ['A', 'B', 'C', 'D'].map((id) => ({ id, text: `o${id}` })),
    });
    expect(JSON.stringify(result)).not.toContain('because');
    expect(callGemini).not.toHaveBeenCalled();
  });

  it('Writing P1', async () => {
    pickContent.mockResolvedValue({
      ok: true,
      data: group({
        title: 'Is it better to live in a city?',
        essay_question: 'Write an essay.',
        context: 'In your English class...',
        notes: [
          { label: 'transport', description: 'd1' },
          { label: 'cost', description: 'd2' },
          { label: 'your own idea', description: 'd3' },
        ],
      }),
    });
    const result = await generateFCEEssayAction();
    expect(result).toMatchObject({ ok: true, data: { bankGroupId: 'g1', framingText: 'framing' } });
    expect(callGemini).not.toHaveBeenCalled();
  });

  it('Speaking P1 and P4 carry the bank group id and ask for the linked topic', async () => {
    pickContent.mockResolvedValue({ ok: true, data: group({ questions: ['Q1?', 'Q2?', 'Q3?'] }) });
    expect(await generateFCEInterviewAction()).toMatchObject({
      ok: true,
      data: { questions: ['Q1?', 'Q2?', 'Q3?'], bank_group_id: 'g1', exam_part: 'fce_speaking_part1' },
    });
    expect(await generateFCEDiscussionAction()).toMatchObject({
      ok: true,
      data: { discussion_questions: ['Q1?', 'Q2?', 'Q3?'], bank_group_id: 'g1' },
    });
    expect(pickContent).toHaveBeenLastCalledWith(expect.objectContaining({ topic: 'Museums', examPart: 'fce_speaking_part4' }));
    expect(callGemini).not.toHaveBeenCalled();
  });

  it('Speaking P2 returns the stored photographs', async () => {
    pickContent.mockResolvedValue({
      ok: true,
      data: group({
        topic: 'Sport',
        comparison_question: 'Why?',
        scene_prompt_a: 'a',
        scene_prompt_b: 'b',
        image_url_a: 'https://img/a.jpg',
        image_url_b: 'https://img/b.jpg',
      }),
    });
    expect(await generateFCEPictureDescriptionAction()).toMatchObject({
      ok: true,
      data: { imageUrlA: 'https://img/a.jpg', imageUrlB: 'https://img/b.jpg', bankGroupId: 'g1' },
    });
    expect(callGemini).not.toHaveBeenCalled();
  });

  it('every action returns no_content with an empty bank and still makes no model call', async () => {
    pickContent.mockResolvedValue({ ok: false, code: 'no_content', retryable: false });
    for (const action of [
      generateFCEClozeAction,
      generateFCEEssayAction,
      generateFCEInterviewAction,
      generateFCEDiscussionAction,
      generateFCEPictureDescriptionAction,
    ]) {
      expect(await action()).toEqual({ ok: false, code: 'no_content', retryable: false });
    }
    expect(callGemini).not.toHaveBeenCalled();
  });

  it('a group without photographs is treated as no content', async () => {
    pickContent.mockResolvedValue({ ok: true, data: group({ comparison_question: 'Why?' }) });
    expect(await generateFCEPictureDescriptionAction()).toMatchObject({ ok: false, code: 'no_content' });
  });
});
