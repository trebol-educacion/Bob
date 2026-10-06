'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { bankStamp, pickPlan } from '@/lib/item-bank/plan-bank';
import { fail, ok, type ActionResult } from '@/lib/result';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';
import { KetVocabGapPlanSchema, type KetVocabGapItem, type KetVocabGapPlan } from '@/lib/bank-plans/ket-reading-part4';

const KET_VOCAB_GAP_PART = 'ket_reading_part4';

export type VocabGapItem = KetVocabGapItem;

export interface VocabGapExercise extends KetVocabGapPlan {
  bank_group_id?: string;
}

export interface VocabGapResult {
  framing_text: string;
  exercise: VocabGapExercise;
}

export interface VocabGapItemResult {
  number: number;
  chosen: 'A' | 'B' | 'C' | null;
  correct_answer: 'A' | 'B' | 'C';
  is_correct: boolean;
}

export interface VocabGapSubmitResult {
  sessionId: string;
  correct_count: number;
  total: number;
  item_results: VocabGapItemResult[];
}

const FRAMING_FALLBACK = 'Read the text and choose the best word, A, B or C, for each gap.';

export async function generateKETVocabGapAction(): Promise<ActionResult<VocabGapResult>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');

  const picked = await pickPlan({
    exam: 'ket',
    cefr: 'a2',
    examPart: KET_VOCAB_GAP_PART,
    skill: 'reading',
    schema: KetVocabGapPlanSchema,
    userId,
  });
  if (!picked.ok) return picked;

  const framingText = await getPrompt('cambridge_ket_reading_part4_a2_framing').catch(() => FRAMING_FALLBACK);
  return ok({ framing_text: framingText, exercise: { ...picked.data.plan, bank_group_id: picked.data.groupId } });
}

export async function submitKETVocabGapAction(input: {
  sessionId?: string;
  framing_text: string;
  exercise: VocabGapExercise;
  answers: Record<number, 'A' | 'B' | 'C' | null>;
}): Promise<VocabGapSubmitResult | { error: string }> {
  const item_results: VocabGapItemResult[] = input.exercise.items.map((item) => {
    const chosen = input.answers[item.number] ?? null;
    return { number: item.number, chosen, correct_answer: item.answer, is_correct: chosen === item.answer };
  });

  const correct_count = item_results.filter((r) => r.is_correct).length;

  const completed = await completeActivity({
    mode: 'cambridge_ket_reading_part4',
    sessionId: input.sessionId,
    bank: bankStamp(KET_VOCAB_GAP_PART, input.exercise.bank_group_id),
    plan: { kind: 'reading_vocab_gap_plan', framing_text: input.framing_text, exercise: input.exercise },
    answers: item_results.map((r) => ({ kind: 'reading_vocab_gap_answer', item_number: r.number, chosen: r.chosen, is_correct: r.is_correct })),
    evaluation: { kind: 'reading_vocab_gap_evaluation', score: correct_count, score_max: input.exercise.items.length, item_results, is_final: true },
  });
  if (!completed.ok) return { error: completed.code };

  return { sessionId: completed.data.sessionId, correct_count, total: input.exercise.items.length, item_results };
}
