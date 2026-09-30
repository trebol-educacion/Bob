import type { StoredMessage } from '@/actions/messages';
import type { MatchingReview } from '@/components/practice/matching';
import { restoreGroupSession } from '@/lib/item-bank/group-restore';
import type { GroupExercisePayload, GroupItemResult, GroupSubmitResult } from '@/lib/item-bank/group-types';
import type { GroupExerciseApi, GroupExerciseController } from './useGroupExercise';

export interface GroupPracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

export function resultsByItem(result: GroupSubmitResult | null): Record<string, GroupItemResult> {
  const byItem: Record<string, GroupItemResult> = {};
  for (const entry of result?.results ?? []) byItem[entry.item_id] = entry;
  return byItem;
}

export function toMatchingReview(result: GroupSubmitResult | null): Record<string, MatchingReview> {
  return Object.fromEntries(
    Object.entries(resultsByItem(result)).map(([id, entry]) => [
      id,
      { isCorrect: entry.is_correct, correctKey: entry.correct_key },
    ]),
  );
}

export type ChoiceGroupApi = GroupExerciseApi<GroupExercisePayload, string, GroupSubmitResult>;

export type ChoiceGroupController = GroupExerciseController<GroupExercisePayload, string, GroupSubmitResult>;

/**
 * @param start
 * @param submit
 * @returns api for parts answered by item id
 */
export function choiceGroupApi(start: ChoiceGroupApi['start'], submit: ChoiceGroupApi['submit']): ChoiceGroupApi {
  return { start, submit, restore: (messages) => restoreGroupSession(messages) };
}
