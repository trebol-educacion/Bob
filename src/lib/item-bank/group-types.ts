export const GROUP_PLAN_KIND = 'fce_group_plan';
export const GROUP_EVALUATION_KIND = 'fce_group_evaluation';

export interface GroupChoice {
  key: string;
  label: string;
  text: string | null;
}

export interface GroupQuestion {
  id: string;
  number: number;
  text: string;
  options: GroupChoice[];
  audioUrl: string | null;
}

export interface GroupExercisePayload {
  groupId: string;
  variantId: string;
  title: string;
  intro: string | null;
  audioUrl: string | null;
  choices: GroupChoice[];
  questions: GroupQuestion[];
}

export interface GroupItemResult {
  item_id: string;
  given: string;
  correct_key: string;
  is_correct: boolean;
  explanation: string | null;
}

export interface GroupSubmitResult {
  correct: number;
  total: number;
  score_10: number;
  results: GroupItemResult[];
}

export type GroupAnswers = Record<string, string>;

export type GroupStartResult = { session_id: string; exercise: GroupExercisePayload } | { error: string };

export type GroupSubmitOutcome = GroupSubmitResult | { error: string };
