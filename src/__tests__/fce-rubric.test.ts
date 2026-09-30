import { describe, it, expect } from 'vitest';
import {
  buildFceScorePayload,
  fceRubricTotal,
  fceScore10,
  parseFceRubric,
} from '@/lib/writing/fce-rubric';

const FULL = { content: 5, communicative_achievement: 5, organisation: 5, language: 5 };

describe('parseFceRubric', () => {
  it('accepts four integer criteria between 0 and 5', () => {
    expect(parseFceRubric(FULL)).toEqual(FULL);
  });

  it('rejects a rubric with a missing criterion', () => {
    expect(parseFceRubric({ content: 4, communicative_achievement: 3, organisation: 3 })).toBeNull();
  });

  it('rejects out of range, fractional and non numeric criteria', () => {
    expect(parseFceRubric({ ...FULL, language: 6 })).toBeNull();
    expect(parseFceRubric({ ...FULL, language: -1 })).toBeNull();
    expect(parseFceRubric({ ...FULL, content: 3.5 })).toBeNull();
    expect(parseFceRubric({ ...FULL, content: '4' })).toBeNull();
  });

  it('rejects the legacy 0-4 rubric and empty values', () => {
    expect(parseFceRubric({ task_coverage: 3, grammar: 2, vocabulary: 3, fluency: 2 })).toBeNull();
    expect(parseFceRubric(undefined)).toBeNull();
    expect(parseFceRubric(null)).toBeNull();
  });
});

describe('fce score', () => {
  it('sums the four criteria out of 20', () => {
    expect(fceRubricTotal({ content: 4, communicative_achievement: 3, organisation: 3, language: 3 })).toBe(13);
  });

  it('derives the 0-10 mark as total / 2', () => {
    expect(fceScore10(FULL)).toBe(10);
    expect(fceScore10({ content: 4, communicative_achievement: 3, organisation: 3, language: 3 })).toBe(6.5);
    expect(fceScore10({ content: 0, communicative_achievement: 0, organisation: 0, language: 0 })).toBe(0);
  });

  it('builds the payload consumed by the activity result mechanism', () => {
    const rubric = { content: 4, communicative_achievement: 3, organisation: 3, language: 3 };
    expect(buildFceScorePayload(rubric)).toEqual({ score: 13, score_max: 20, score_10: 6.5, fce_rubric: rubric });
  });
});
