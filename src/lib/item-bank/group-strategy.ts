import type { ItemBankSkill } from './types';
import { gradeGroupAnswers, type AnswerMatcher } from './group-grading';
import { toGroupPayload } from './group-payload';
import type { GroupSessionStrategy } from './group-session-types';
import type { GroupAnswers, GroupExercisePayload, GroupSubmitResult } from './group-types';

export interface GroupPartConfig {
  mode: string;
  examPart: string;
  skill: ItemBankSkill;
  title: string;
  matcher: AnswerMatcher;
}

export type ChoiceGroupStrategy = GroupSessionStrategy<GroupExercisePayload, GroupAnswers, GroupSubmitResult>;

/**
 * @param config
 * @returns strategy for parts answered by item id
 */
export function createGroupStrategy({ matcher, ...part }: GroupPartConfig): ChoiceGroupStrategy {
  return {
    ...part,
    toPublic: toGroupPayload,
    grade: (items, answers) => gradeGroupAnswers(items, answers, matcher),
    summarize: (result) => ({ correct: result.correct, total: result.total, score10: result.score_10 }),
  };
}
