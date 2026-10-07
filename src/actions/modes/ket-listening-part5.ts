'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { bankStamp, loadPlan, pickPlan } from '@/lib/item-bank/plan-bank';
import { fail, ok, type ActionResult } from '@/lib/result';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';
import { stripDashes } from '@/lib/text';
import { KetListenMatchPlanSchema, toPublicListenMatch, type KetListenMatchPublic } from '@/lib/bank-plans/ket-listening-part5';
import { gradeListenMatch, listenMatchTranscript, type KeyedResult } from '@/lib/ket/listening-grading';

const PART = 'ket_listening_part5';
const FRAMING_FALLBACK = 'You will hear a conversation. Match each person to the right answer. There are three letters you do not need.';

export interface KetListenMatchExercise extends KetListenMatchPublic {
  bank_group_id: string;
}

export interface KetListenMatchStart {
  framing_text: string;
  exercise: KetListenMatchExercise;
}

export interface KetListenMatchSubmitResult {
  sessionId: string;
  correct_count: number;
  total: number;
  person_results: KeyedResult[];
  transcript: string;
}

/** @returns a matching conversation from the bank, without keys or transcript */
export async function startKETListenMatchAction(): Promise<ActionResult<KetListenMatchStart>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');

  const picked = await pickPlan({ exam: 'ket', cefr: 'a2', examPart: PART, skill: 'listening', schema: KetListenMatchPlanSchema, userId });
  if (!picked.ok) return picked;

  const framingText = await getPrompt('cambridge_ket_listening_part5_a2_framing').catch(() => FRAMING_FALLBACK);
  return ok({
    framing_text: stripDashes(framingText),
    exercise: { ...toPublicListenMatch(picked.data.plan), bank_group_id: picked.data.groupId },
  });
}

/**
 * @param input.answers option chosen per person number
 * @returns per-person results graded against the keys stored in the bank
 */
export async function submitKETListenMatchAction(input: {
  sessionId?: string;
  framing_text: string;
  exercise: KetListenMatchExercise;
  answers: Record<number, string>;
}): Promise<ActionResult<KetListenMatchSubmitResult>> {
  const plan = await loadPlan(input.exercise.bank_group_id, KetListenMatchPlanSchema);
  if (!plan.ok) return plan;

  const person_results = gradeListenMatch(plan.data, input.answers);
  const correct_count = person_results.filter((r) => r.is_correct).length;
  const transcript = listenMatchTranscript(plan.data);

  const completed = await completeActivity({
    mode: 'cambridge_ket_listening_part5',
    sessionId: input.sessionId,
    bank: bankStamp(PART, input.exercise.bank_group_id),
    plan: { kind: 'ket_listen_match_plan', framing_text: input.framing_text, exercise: input.exercise },
    answers: person_results.map((r) => ({ kind: 'ket_listen_match_answer', person_number: r.number, chosen: r.chosen, is_correct: r.is_correct })),
    evaluation: { kind: 'ket_listen_match_evaluation', score: correct_count, score_max: person_results.length, person_results, transcript, is_final: true },
  });
  if (!completed.ok) return fail(completed.code);

  return ok({ sessionId: completed.data.sessionId, correct_count, total: person_results.length, person_results, transcript });
}
