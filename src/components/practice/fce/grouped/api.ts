import { startFCEReadingExerciseAction, submitFCEReadingExerciseAction } from '@/actions/modes/fce-reading-grouped';
import type { GroupExerciseApi } from '@/components/practice/group-exercise/useGroupExercise';
import { restoreGroupSession } from '@/lib/item-bank/group-restore';
import { FCE_GROUPED_PARTS, type FCEGroupedExercise, type FCEGroupedPart, type FCEGroupedSubmitResult } from '@/lib/reading/fce-grouped-types';

export type GroupedApi = GroupExerciseApi<FCEGroupedExercise, number, FCEGroupedSubmitResult>;

function createGroupedApi(part: FCEGroupedPart): GroupedApi {
  return {
    start: () => startFCEReadingExerciseAction({ part }),
    submit: (sessionId, answers) => submitFCEReadingExerciseAction({ sessionId, part, answers }),
    restore: (messages) => restoreGroupSession(messages, part),
    answersOf: (result) => Object.fromEntries(result.results.map((entry) => [entry.number, entry.given])),
  };
}

export const GROUPED_API_BY_PART = Object.fromEntries(
  FCE_GROUPED_PARTS.map((part) => [part, createGroupedApi(part)]),
) as Record<FCEGroupedPart, GroupedApi>;
