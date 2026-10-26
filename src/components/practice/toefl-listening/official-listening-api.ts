import { startOfficialListeningAction, submitOfficialListeningAction } from '@/actions/modes/toefl-official-listening';
import type { GroupExerciseApi } from '@/components/practice/group-exercise/useGroupExercise';
import { OFFICIAL_LISTENING_PARTS, type OfficialListeningPart } from '@/lib/bank-plans/toefl-official-listening';
import { restoreGroupSession } from '@/lib/item-bank/group-restore';
import type { GroupExercisePayload } from '@/lib/item-bank/group-types';
import type { OfficialListeningResult } from '@/lib/toefl/official-listening-bank';

export type OfficialListeningApi = GroupExerciseApi<GroupExercisePayload, string, OfficialListeningResult>;

/**
 * @param result graded result
 * @returns selected letter per question id, so a reopened session shows the student's choices
 */
export function answersOfResult(result: OfficialListeningResult): Record<string, string> {
  return Object.fromEntries(result.results.map((entry) => [entry.item_id, entry.given]));
}

function apiFor(part: OfficialListeningPart): OfficialListeningApi {
  return {
    start: () => startOfficialListeningAction(part),
    submit: (input) => submitOfficialListeningAction(part, input),
    restore: (messages) => restoreGroupSession<GroupExercisePayload, OfficialListeningResult>(messages, part),
    answersOf: answersOfResult,
  };
}

export const OFFICIAL_LISTENING_APIS = Object.fromEntries(
  OFFICIAL_LISTENING_PARTS.map((part) => [part, apiFor(part)]),
) as Record<OfficialListeningPart, OfficialListeningApi>;
