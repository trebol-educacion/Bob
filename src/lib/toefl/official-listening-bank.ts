import type { OfficialListeningPart, ToeflOfficialListeningPlan } from '@/lib/bank-plans/toefl-official-listening';
import { scoreOutOfTen } from '@/lib/item-bank/group-grading';
import { GROUP_ANSWERS_KIND, GROUP_EVALUATION_KIND, GROUP_PLAN_KIND } from '@/lib/item-bank/group-session-types';
import type { GroupAnswers, GroupExercisePayload, GroupItemResult, GroupSubmitResult } from '@/lib/item-bank/group-types';

export interface OfficialListeningResult extends GroupSubmitResult {
  transcript: string;
}

/**
 * @param groupId bank group of the audio
 * @param number official question number
 * @returns stable question id inside the group
 */
export function officialQuestionId(groupId: string, number: number): string {
  return `${groupId}-q${number}`;
}

/**
 * @param plan stored official set
 * @param groupId bank group the set came from
 * @returns exercise for the client without keys nor transcript
 */
export function toOfficialListeningExercise(plan: ToeflOfficialListeningPlan, groupId: string): GroupExercisePayload {
  return {
    groupId,
    variantId: groupId,
    title: plan.directions,
    intro: null,
    audioUrl: plan.audio_url,
    choices: [],
    questions: plan.questions.map((question) => ({
      id: officialQuestionId(groupId, question.number),
      number: question.number,
      text: question.question,
      options: question.options.map((option) => ({ key: option.key, label: option.label, text: null })),
      audioUrl: null,
    })),
  };
}

/**
 * @param plan stored official set with its keys
 * @param groupId bank group the set came from
 * @param answers selected letter per question id
 * @returns deterministic result graded against the official keys, with the transcript revealed
 */
export function gradeOfficialListening(
  plan: ToeflOfficialListeningPlan,
  groupId: string,
  answers: GroupAnswers,
): OfficialListeningResult {
  const results: GroupItemResult[] = plan.questions.map((question) => {
    const id = officialQuestionId(groupId, question.number);
    const given = (answers[id] ?? '').trim().toUpperCase();
    return { item_id: id, given, correct_key: question.correct_key, is_correct: given === question.correct_key, explanation: null };
  });
  const correct = results.filter((result) => result.is_correct).length;
  return { correct, total: results.length, score_10: scoreOutOfTen(correct, results.length), results, transcript: plan.transcript };
}

/**
 * @param part official listening part
 * @param exercise exercise shown to the student
 * @returns plan message payload restorable by the grouped exercise flow
 */
export function officialListeningPlanPayload(part: OfficialListeningPart, exercise: GroupExercisePayload) {
  return { kind: GROUP_PLAN_KIND, exam_part: part, exercise };
}

/**
 * @param part official listening part
 * @param answers selected letter per question id
 * @returns answers turn payload
 */
export function officialListeningAnswersPayload(part: OfficialListeningPart, answers: GroupAnswers) {
  return { kind: GROUP_ANSWERS_KIND, exam_part: part, answers };
}

/**
 * @param part official listening part
 * @param result graded result
 * @param answers selected letter per question id
 * @returns final evaluation payload graded by hits over total
 */
export function officialListeningEvaluation(part: OfficialListeningPart, result: OfficialListeningResult, answers: GroupAnswers) {
  return {
    kind: GROUP_EVALUATION_KIND,
    exam_part: part,
    score: result.correct,
    score_max: result.total,
    score_10: result.score_10,
    result,
    answers,
  };
}
