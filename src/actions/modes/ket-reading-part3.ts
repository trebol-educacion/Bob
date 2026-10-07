'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { bankStamp, pickPlan } from '@/lib/item-bank/plan-bank';
import { fail, ok, type ActionResult } from '@/lib/result';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';
import { KetLongTextPlanSchema, type KetLongTextItem, type KetLongTextPlan } from '@/lib/bank-plans/ket-reading-part3';

const KET_LONG_TEXT_PART = 'ket_reading_part3';

export type LongTextItem = KetLongTextItem;

export interface LongTextExercise extends KetLongTextPlan {
  bank_group_id?: string;
}

export interface LongTextResult {
  framing_text: string;
  exercise: LongTextExercise;
}

export interface LongTextItemResult {
  number: number;
  chosen: 'A' | 'B' | 'C' | null;
  correct_answer: 'A' | 'B' | 'C';
  is_correct: boolean;
}

export interface LongTextSubmitResult {
  sessionId: string;
  correct_count: number;
  total: number;
  item_results: LongTextItemResult[];
}

const FRAMING_FALLBACK = 'Read the article carefully. Then choose the best answer, A, B or C, for each question.';

export async function generateKETLongTextAction(): Promise<ActionResult<LongTextResult>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');

  const picked = await pickPlan({
    exam: 'ket',
    cefr: 'a2',
    examPart: KET_LONG_TEXT_PART,
    skill: 'reading',
    schema: KetLongTextPlanSchema,
    userId,
  });
  if (!picked.ok) return picked;

  const framingText = await getPrompt('cambridge_ket_reading_part3_a2_framing').catch(() => FRAMING_FALLBACK);
  return ok({ framing_text: framingText, exercise: { ...picked.data.plan, bank_group_id: picked.data.groupId } });
}

export async function submitKETLongTextAction(input: {
  sessionId?: string;
  framing_text: string;
  exercise: LongTextExercise;
  answers: Record<number, 'A' | 'B' | 'C' | null>;
}): Promise<LongTextSubmitResult | { error: string }> {
  const item_results: LongTextItemResult[] = input.exercise.items.map((item) => {
    const chosen = input.answers[item.number] ?? null;
    return { number: item.number, chosen, correct_answer: item.answer, is_correct: chosen === item.answer };
  });

  const correct_count = item_results.filter((r) => r.is_correct).length;

  const completed = await completeActivity({
    mode: 'cambridge_ket_reading_part3',
    sessionId: input.sessionId,
    bank: bankStamp(KET_LONG_TEXT_PART, input.exercise.bank_group_id),
    plan: { kind: 'reading_long_plan', framing_text: input.framing_text, exercise: input.exercise },
    answers: item_results.map((r) => ({ kind: 'reading_long_answer', item_number: r.number, chosen: r.chosen, is_correct: r.is_correct })),
    evaluation: { kind: 'reading_long_evaluation', score: correct_count, score_max: input.exercise.items.length, item_results, is_final: true },
  });
  if (!completed.ok) return { error: completed.code };

  return { sessionId: completed.data.sessionId, correct_count, total: input.exercise.items.length, item_results };
}
