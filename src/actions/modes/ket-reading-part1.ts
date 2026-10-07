'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { bankStamp, pickPlan } from '@/lib/item-bank/plan-bank';
import { fail, ok, type ActionResult } from '@/lib/result';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';
import { KetSignsPlanSchema, type KetSignItem } from '@/lib/bank-plans/ket-reading-part1';

const KET_SIGNS_PART = 'ket_reading_part1';

export type SignOption = KetSignItem['options'][number];

/** A single sign/notice item as returned to the client. */
export type SignItem = KetSignItem;

/** Full result of a successful generation call. */
export interface KETSignsAndNoticesResult {
  items: SignItem[];
  framingText: string;
  bankGroupId: string;
}

/** Per-item answer result returned after submit. */
export interface SignAnswerResult {
  number: number;
  chosen: 'A' | 'B' | 'C';
  correct_option: 'A' | 'B' | 'C';
  isCorrect: boolean;
  explanation: string;
}

/** Full submit result. */
export interface KETSignsSubmitResult {
  sessionId: string;
  correctCount: number;
  total: number;
  results: SignAnswerResult[];
}

const FRAMING_FALLBACK = 'You will read 6 signs and notices. For each one, choose the meaning that fits best, A, B or C.';

/** Reads one pregenerated set of 6 signs from the bank; no model call and no session row. */
export async function generateKETSignsAndNoticesAction(): Promise<ActionResult<KETSignsAndNoticesResult>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');

  const picked = await pickPlan({
    exam: 'ket',
    cefr: 'a2',
    examPart: KET_SIGNS_PART,
    skill: 'reading',
    schema: KetSignsPlanSchema,
    userId,
  });
  if (!picked.ok) return picked;

  const framingText = await getPrompt('cambridge_ket_reading_part1_a2_framing').catch(() => FRAMING_FALLBACK);
  return ok({ items: picked.data.plan.items, framingText, bankGroupId: picked.data.groupId });
}

/** Evaluates student answers deterministically (no LLM) and persists results. */
export async function submitKETSignsAnswersAction(input: {
  sessionId?: string;
  framingText: string;
  bankGroupId?: string;
  answers: Record<number, 'A' | 'B' | 'C'>;
  items: SignItem[];
}): Promise<KETSignsSubmitResult | { error: string }> {
  const results: SignAnswerResult[] = input.items.map((item) => {
    const chosen = input.answers[item.number] ?? 'A';
    return {
      number: item.number,
      chosen,
      correct_option: item.correct_option,
      isCorrect: chosen === item.correct_option,
      explanation: item.explanation,
    };
  });

  const correctCount = results.filter((r) => r.isCorrect).length;
  const total = input.items.length;

  const completed = await completeActivity({
    mode: 'cambridge_ket_reading_part1',
    sessionId: input.sessionId,
    bank: bankStamp(KET_SIGNS_PART, input.bankGroupId),
    plan: { kind: 'reading_prompt', items: input.items, framing_text: input.framingText },
    answers: results.map((r) => ({ kind: 'reading_answer', item_number: r.number, chosen: r.chosen, isCorrect: r.isCorrect })),
    evaluation: { kind: 'reading_evaluation', score: correctCount, score_max: total, results },
  });
  if (!completed.ok) return { error: completed.code };

  return { sessionId: completed.data.sessionId, correctCount, total, results };
}
