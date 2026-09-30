import { describe, it, expect } from 'vitest';
import { toPublicExercise } from '@/lib/reading/fce-grouped-public';
import { gradeExercise, isItemCorrect, toScore10 } from '@/lib/reading/fce-grouped-grading';
import { pickGroup } from '@/lib/reading/pick-group';
import { restoreGroupedExercise } from '@/components/practice/fce/grouped/restore';
import * as fx from './fce-grouped-fixtures';

const SENSITIVE = ['without', 'although', 'frustration', 'is said to be', 'Secret explanation', 'extra_key', 'accepted', 'correct_key'];

function expectNoLeak(payload: unknown, allowed: string[] = []) {
  const serialized = JSON.stringify(payload);
  for (const word of SENSITIVE.filter((w) => !allowed.includes(w))) {
    expect(serialized).not.toContain(word);
  }
}

describe('toPublicExercise', () => {
  it('P2 hides keys and accepted answers and inlines the example', () => {
    const exercise = toPublicExercise('fce_reading_part2', fx.OPEN_CLOZE_GROUP, fx.OPEN_CLOZE_ITEMS);
    expect(exercise.text).toContain('(0) to the alarm');
    expect(exercise.text).toContain('___9___');
    expect(exercise.items.map((i) => i.number)).toEqual([9, 10, 11]);
    expectNoLeak(exercise, ['without', 'although']);
    expect(JSON.stringify(exercise)).not.toContain('accepted');
  });

  it('P3 strips inline base words from the text and exposes them per item', () => {
    const exercise = toPublicExercise('fce_reading_part3', fx.WORD_FORMATION_GROUP, fx.WORD_FORMATION_ITEMS);
    expect(exercise.text).toContain('(0) increasingly (INCREASE)');
    expect(exercise.text).toContain('___17___.');
    expect(exercise.text).not.toContain('(FRUSTRATE)');
    expect(exercise.items.map((i) => i.baseWord)).toEqual(['FRUSTRATE', 'DEDICATE']);
    expectNoLeak(exercise);
  });

  it('P4 exposes prompt, keyword and sentence with gap only', () => {
    const exercise = toPublicExercise('fce_reading_part4', fx.KEY_WORD_GROUP, fx.KEY_WORD_ITEMS);
    expect(exercise.text).toBeNull();
    expect(exercise.items[0]).toEqual({
      number: 25,
      prompt: 'People say that the mayor is very committed.',
      keyword: 'SAID',
      sentenceWithGap: 'The mayor ________ very committed.',
    });
    expectNoLeak(exercise, ['is said to be']);
    expect(JSON.stringify(exercise)).not.toContain('is said to be');
  });

  it('P5 exposes options without correct key or explanation', () => {
    const exercise = toPublicExercise('fce_reading_part5', fx.MULTIPLE_CHOICE_GROUP, fx.MULTIPLE_CHOICE_ITEMS);
    expect(exercise.items[0].options).toHaveLength(4);
    expect(exercise.items[0]).not.toHaveProperty('correct_key');
    expectNoLeak(exercise);
  });

  it('P6 exposes shared sentences but not the extra key', () => {
    const exercise = toPublicExercise('fce_reading_part6', fx.GAPPED_TEXT_GROUP, fx.GAPPED_TEXT_ITEMS);
    expect(exercise.sentences).toHaveLength(3);
    expect(exercise.text).toContain('___37___');
    expectNoLeak(exercise);
  });
});

describe('grading', () => {
  it('P2 accepts listed variants case-insensitively and rejects others', () => {
    const graded = gradeExercise('fce_reading_part2', fx.OPEN_CLOZE_ITEMS, {
      9: ' Without ',
      10: 'in',
      11: 'WHILE',
    });
    expect(graded.results.map((r) => r.isCorrect)).toEqual([true, false, true]);
    expect(graded.correct).toBe(2);
    expect(graded.score10).toBe(6.7);
  });

  it('P3 grades against the derived word', () => {
    const graded = gradeExercise('fce_reading_part3', fx.WORD_FORMATION_ITEMS, {
      17: 'frustration',
      18: 'dedicated',
    });
    expect(graded.correct).toBe(1);
    expect(graded.score10).toBe(5);
  });

  it('P4 requires keyword and 2-5 words on top of an accepted answer', () => {
    const [said, difficulty] = fx.KEY_WORD_ITEMS;
    expect(isItemCorrect('fce_reading_part4', said, 'is said to be')).toBe(true);
    expect(isItemCorrect('fce_reading_part4', said, 'IS  Said to be')).toBe(true);
    expect(isItemCorrect('fce_reading_part4', difficulty, 'have difficulty in attending')).toBe(true);
    expect(isItemCorrect('fce_reading_part4', said, 'said')).toBe(false);
    expect(isItemCorrect('fce_reading_part4', said, '')).toBe(false);
  });

  it('P4 rejects answers without the keyword or beyond five words', () => {
    const [said] = fx.KEY_WORD_ITEMS;
    const noKeyword = { ...said, correct_key: 'is believed to be', metadata: { ...said.metadata, accepted: ['is believed to be'] } };
    expect(isItemCorrect('fce_reading_part4', noKeyword, 'is believed to be')).toBe(false);
    const long = { ...said, correct_key: 'is said to be really', metadata: { ...said.metadata, accepted: ['it is often said to be really'] } };
    expect(isItemCorrect('fce_reading_part4', long, 'it is often said to be really')).toBe(false);
  });

  it('P5 and P6 compare letters', () => {
    const mc = gradeExercise('fce_reading_part5', fx.MULTIPLE_CHOICE_ITEMS, { 31: 'A', 32: 'C' });
    expect(mc.correct).toBe(1);
    expect(mc.results[1].expected).toBe('B');
    const gapped = gradeExercise('fce_reading_part6', fx.GAPPED_TEXT_ITEMS, { 37: 'c', 38: 'A' });
    expect(gapped.score10).toBe(10);
  });

  it('unanswered items count as incorrect', () => {
    const graded = gradeExercise('fce_reading_part6', fx.GAPPED_TEXT_ITEMS, {});
    expect(graded.correct).toBe(0);
    expect(graded.results.map((r) => r.given)).toEqual(['', '']);
  });

  it('toScore10 scales to one decimal and guards empty totals', () => {
    expect(toScore10(5, 6)).toBe(8.3);
    expect(toScore10(0, 0)).toBe(0);
  });
});

describe('pickGroup', () => {
  const groups = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('avoids recent groups when possible', () => {
    expect(pickGroup(groups, ['a', 'b'], () => 0)?.id).toBe('c');
  });

  it('falls back to any group when all were seen and null when empty', () => {
    expect(pickGroup(groups, ['a', 'b', 'c'], () => 0.99)?.id).toBe('c');
    expect(pickGroup([], [], () => 0)).toBeNull();
  });
});

describe('restoreGroupedExercise', () => {
  const exercise = toPublicExercise('fce_reading_part5', fx.MULTIPLE_CHOICE_GROUP, fx.MULTIPLE_CHOICE_ITEMS);
  const plan = { role: 'bob', content_json: { kind: 'fce_grouped_plan', part: 'fce_reading_part5', exercise } };

  it('restores an unfinished exercise', () => {
    const restored = restoreGroupedExercise('fce_reading_part5', [plan]);
    expect(restored?.exercise.groupId).toBe(exercise.groupId);
    expect(restored?.results).toBeNull();
  });

  it('restores the final result', () => {
    const evaluation = {
      role: 'bob',
      content_json: {
        kind: 'fce_grouped_evaluation',
        part: 'fce_reading_part5',
        score: 1,
        score_max: 2,
        score_10: 5,
        is_final: true,
        results: [{ number: 31, given: 'A', expected: 'A', isCorrect: true }],
      },
    };
    const restored = restoreGroupedExercise('fce_reading_part5', [plan, evaluation]);
    expect(restored?.score).toEqual({ correct: 1, total: 2, score10: 5 });
  });

  it('returns null without a plan or for another part', () => {
    expect(restoreGroupedExercise('fce_reading_part5', [])).toBeNull();
    expect(restoreGroupedExercise('fce_reading_part2', [plan])).toBeNull();
  });
});
