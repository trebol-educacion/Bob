import { describe, it, expect } from 'vitest';
import { toPublicItem, toPublicGroup } from '@/lib/item-bank/public';
import { scoreClosedAnswers } from '@/lib/item-bank/scoring';
import type { BankItem, ItemGroup } from '@/lib/item-bank/types';

const baseItem: BankItem = {
  id: 'item-1',
  framework: 'toefl',
  exam_part: 'listen_choose_response',
  cefr_level: 'b1',
  variant_id: 'lcr-01',
  stimulus_audio_url: null,
  stimulus_text: null,
  stimulus_image_url: null,
  question: 'What does the speaker mean?',
  options: [
    { key: 'A', label: 'Option A' },
    { key: 'B', label: 'Option B' },
  ],
  correct_key: 'B',
  explanation: 'The speaker explicitly states B.',
  source: 'official',
  group_id: 'group-1',
  group_order: 1,
};

const baseGroup: ItemGroup = {
  id: 'group-1',
  exam: 'toefl',
  skill: 'listening',
  cefr_level: 'b1',
  difficulty: 2,
  purpose: 'practice',
  module_code: null,
  exam_part: null,
  variant_id: null,
  metadata: {},
  stimulus_text: null,
  stimulus_audio_url: null,
  stimulus_image_url: null,
  source: 'official',
  source_ref: 'Referencias/TOELF/toefl-full-length-practice-test1.pdf p.12',
  status: 'published',
  reviewed_by: 'reviewer-1',
  reviewed_at: '2026-05-16T00:00:00.000Z',
  created_at: '2026-05-16T00:00:00.000Z',
};

describe('toPublicItem', () => {
  it('strips correct_key and explanation', () => {
    const publicItem = toPublicItem(baseItem);
    expect(publicItem).not.toHaveProperty('correct_key');
    expect(publicItem).not.toHaveProperty('explanation');
    expect(publicItem).not.toHaveProperty('transcript');
    expect(publicItem).not.toHaveProperty('metadata');
    expect(publicItem.id).toBe('item-1');
    expect(publicItem.question).toBe(baseItem.question);
  });
});

describe('toPublicGroup', () => {
  it('strips reviewed_by, reviewed_at and source_ref', () => {
    const publicGroup = toPublicGroup(baseGroup);
    expect(publicGroup).not.toHaveProperty('reviewed_by');
    expect(publicGroup).not.toHaveProperty('reviewed_at');
    expect(publicGroup).not.toHaveProperty('source_ref');
    expect(publicGroup.id).toBe('group-1');
    expect(publicGroup.status).toBe('published');
  });
});

describe('scoreClosedAnswers', () => {
  const items = [
    { id: 'item-1', correct_key: 'B' },
    { id: 'item-2', correct_key: 'A' },
    { id: 'item-3', correct_key: 'C' },
  ];

  it('counts correct and total', () => {
    const result = scoreClosedAnswers(items, [
      { item_id: 'item-1', selected_key: 'B' },
      { item_id: 'item-2', selected_key: 'A' },
      { item_id: 'item-3', selected_key: 'D' },
    ]);
    expect(result.correct).toBe(2);
    expect(result.total).toBe(3);
    expect(result.correct_item_ids).toEqual(['item-1', 'item-2']);
    expect(result.failed_item_ids).toEqual(['item-3']);
  });

  it('treats an answer for an unknown item as failed', () => {
    const result = scoreClosedAnswers(items, [
      { item_id: 'missing-item', selected_key: 'A' },
    ]);
    expect(result.correct).toBe(0);
    expect(result.total).toBe(1);
    expect(result.failed_item_ids).toEqual(['missing-item']);
  });

  it('returns zero for empty answers', () => {
    const result = scoreClosedAnswers(items, []);
    expect(result.correct).toBe(0);
    expect(result.total).toBe(0);
  });
});
