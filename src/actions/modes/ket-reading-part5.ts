'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { bankStamp, loadPlan, pickPlan } from '@/lib/item-bank/plan-bank';
import { fail, ok, type ActionResult } from '@/lib/result';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';
import {
  KetOpenClozePlanSchema,
  toPublicOpenCloze,
  type KetOpenClozePublic,
} from '@/lib/bank-plans/ket-reading-part5';
import { gradeOpenCloze, type OpenClozeGapResult } from '@/lib/ket/open-cloze-grading';

const KET_OPEN_CLOZE_PART = 'ket_reading_part5';
const FRAMING_FALLBACK = 'Read the text and write ONE word in each gap.';

export interface KetOpenClozeExercise extends KetOpenClozePublic {
  bank_group_id: string;
}

export interface KetOpenClozeStart {
  framing_text: string;
  exercise: KetOpenClozeExercise;
}

export interface KetOpenClozeSubmitResult {
  sessionId: string;
  correct_count: number;
  total: number;
  gap_results: OpenClozeGapResult[];
}

/** @returns a published open cloze from the bank, without its keys */
export async function startKETOpenClozeAction(): Promise<ActionResult<KetOpenClozeStart>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');

  const picked = await pickPlan({
    exam: 'ket',
    cefr: 'a2',
    examPart: KET_OPEN_CLOZE_PART,
    skill: 'reading',
    schema: KetOpenClozePlanSchema,
    userId,
  });
  if (!picked.ok) return picked;

  const framingText = await getPrompt('cambridge_ket_reading_part5_a2_framing').catch(() => FRAMING_FALLBACK);
  return ok({
    framing_text: framingText,
    exercise: { ...toPublicOpenCloze(picked.data.plan), bank_group_id: picked.data.groupId },
  });
}

/**
 * @param input.exercise public exercise shown to the student
 * @param input.answers word written per gap number
 * @returns per-gap results graded against the keys stored in the bank
 */
export async function submitKETOpenClozeAction(input: {
  sessionId?: string;
  framing_text: string;
  exercise: KetOpenClozeExercise;
  answers: Record<number, string>;
}): Promise<ActionResult<KetOpenClozeSubmitResult>> {
  const plan = await loadPlan(input.exercise.bank_group_id, KetOpenClozePlanSchema);
  if (!plan.ok) return plan;

  const gap_results = gradeOpenCloze(plan.data, input.answers);
  const correct_count = gap_results.filter((r) => r.is_correct).length;

  const completed = await completeActivity({
    mode: 'cambridge_ket_reading_part5',
    sessionId: input.sessionId,
    bank: bankStamp(KET_OPEN_CLOZE_PART, input.exercise.bank_group_id),
    plan: { kind: 'ket_open_cloze_plan', framing_text: input.framing_text, exercise: input.exercise },
    answers: gap_results.map((r) => ({ kind: 'ket_open_cloze_answer', gap_number: r.number, given: r.given, is_correct: r.is_correct })),
    evaluation: {
      kind: 'ket_open_cloze_evaluation',
      score: correct_count,
      score_max: gap_results.length,
      gap_results,
      is_final: true,
    },
  });
  if (!completed.ok) return fail(completed.code);

  return ok({ sessionId: completed.data.sessionId, correct_count, total: gap_results.length, gap_results });
}
