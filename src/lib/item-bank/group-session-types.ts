import type { BankItem, ItemBankSkill, ItemGroup } from './types';

export const GROUP_PLAN_KIND = 'fce_group_plan';
export const GROUP_EVALUATION_KIND = 'fce_group_evaluation';

export interface GroupScoreSummary {
  correct: number;
  total: number;
  score10: number;
}

export interface GroupSessionStrategy<E extends { groupId: string }, A, R> {
  mode: string;
  examPart: string;
  skill: ItemBankSkill;
  title: string;
  toPublic: (group: ItemGroup, items: BankItem[]) => E;
  grade: (items: BankItem[], answers: A) => R;
  summarize: (result: R) => GroupScoreSummary;
}

export type GroupStartOutcome<E> = { sessionId: string; exercise: E } | { error: string };

export type GroupSubmitOutcome<R> = R | { error: string };

export function isGroupFailure<T>(outcome: T | { error: string }): outcome is { error: string } {
  return typeof outcome === 'object' && outcome !== null && 'error' in outcome;
}

export interface RestorableMessage {
  role: string;
  content_json?: unknown;
}

export interface RestoredGroupSession<E, R> {
  exercise: E;
  result: R | null;
}
