'use server';

import { bankStamp, loadPlan, pickPlan } from '@/lib/item-bank/plan-bank';
import {
  ToeflOfficialListeningPlanSchema,
  isOfficialListeningPart,
  type OfficialListeningPart,
} from '@/lib/bank-plans/toefl-official-listening';
import {
  gradeOfficialListening,
  officialListeningAnswersPayload,
  officialListeningEvaluation,
  officialListeningPlanPayload,
  toOfficialListeningExercise,
  type OfficialListeningResult,
} from '@/lib/toefl/official-listening-bank';
import { completeActivity } from '@/lib/session/complete';
import { currentUserId } from '@/lib/session/lifecycle';
import type { GroupStartOutcome, GroupSubmitInput, GroupSubmitOutcome } from '@/lib/item-bank/group-session-types';
import type { GroupAnswers, GroupExercisePayload } from '@/lib/item-bank/group-types';

const NO_EXERCISE = 'No exercise available';
const LOAD_FAILED = 'Could not load exercise';
const SAVE_FAILED = 'Could not save result';

/**
 * @param part official TOEFL listening part
 * @returns one official audio with its questions from the bank, keys withheld; no model or TTS call
 */
export async function startOfficialListeningAction(part: OfficialListeningPart): Promise<GroupStartOutcome<GroupExercisePayload>> {
  if (!isOfficialListeningPart(part)) return { error: NO_EXERCISE };
  const userId = await currentUserId();
  if (!userId) return { error: 'Not authenticated' };
  const picked = await pickPlan({
    exam: 'toefl',
    cefr: 'b1',
    examPart: part,
    skill: 'listening',
    schema: ToeflOfficialListeningPlanSchema,
    userId,
  });
  if (!picked.ok) return { error: picked.code === 'no_content' ? NO_EXERCISE : LOAD_FAILED };
  return { exercise: toOfficialListeningExercise(picked.data.plan, picked.data.groupId) };
}

/**
 * @param part official TOEFL listening part
 * @param input session (none on the first submit), bank group and answers
 * @returns result graded on the server against the official keys; the session is created and closed with its 0-10 grade
 */
export async function submitOfficialListeningAction(
  part: OfficialListeningPart,
  input: GroupSubmitInput<GroupAnswers>,
): Promise<GroupSubmitOutcome<OfficialListeningResult>> {
  if (!isOfficialListeningPart(part)) return { error: LOAD_FAILED };
  const plan = await loadPlan(input.groupId, ToeflOfficialListeningPlanSchema);
  if (!plan.ok) return { error: LOAD_FAILED };
  const result = gradeOfficialListening(plan.data, input.groupId, input.answers);
  const completed = await completeActivity({
    mode: part,
    sessionId: input.sessionId,
    bank: bankStamp(part, input.groupId),
    plan: officialListeningPlanPayload(part, toOfficialListeningExercise(plan.data, input.groupId)),
    answers: [officialListeningAnswersPayload(part, input.answers)],
    evaluation: officialListeningEvaluation(part, result, input.answers),
  });
  if (!completed.ok) return { error: SAVE_FAILED };
  return { sessionId: completed.data.sessionId, result };
}
