import { gradeExercise } from './fce-grouped-grading';
import { toPublicExercise } from './fce-grouped-public';
import type { GroupSessionStrategy } from '@/lib/item-bank/group-session-types';
import type { FCEGroupedExercise, FCEGroupedPart, FCEGroupedSubmitResult } from './fce-grouped-types';

export type FCEGroupedAnswers = Record<number, string>;

export type FCEGroupedStrategy = GroupSessionStrategy<FCEGroupedExercise, FCEGroupedAnswers, FCEGroupedSubmitResult>;

const TITLES: Record<FCEGroupedPart, string> = {
  fce_reading_part2: 'Reading Part 2, Open Cloze',
  fce_reading_part3: 'Reading Part 3, Word Formation',
  fce_reading_part4: 'Reading Part 4, Key Word Transformation',
  fce_reading_part5: 'Reading Part 5, Multiple Choice',
  fce_reading_part6: 'Reading Part 6, Gapped Text',
};

/**
 * @param part
 * @returns strategy for parts answered by gap number
 */
export function fceGroupedStrategy(part: FCEGroupedPart): FCEGroupedStrategy {
  return {
    mode: `cambridge_${part}`,
    examPart: part,
    skill: 'reading',
    title: TITLES[part],
    toPublic: (group, items) => toPublicExercise(part, group, items),
    grade: (items, answers) => gradeExercise(part, items, answers),
    summarize: (result) => result,
  };
}
