'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { bankStamp, pickPlan } from '@/lib/item-bank/plan-bank';
import { PetShortTextsPlanSchema, type PetShortTextsPlan } from '@/lib/bank-plans/pet-reading-part1';
import { fail, ok, type ActionResult } from '@/lib/result';
import { completeActivity } from '@/lib/session/complete';
import { currentUserId } from '@/lib/session/lifecycle';

export type ShortTextOption = PetShortTextsPlan['items'][number]['options'][number];

/** A single short-text item as returned to the client. */
export interface ShortTextItem {
  number: number;
  text_body: string;
  text_context: string;
  question: string;
  options: ShortTextOption[];
  correct_option: 'A' | 'B' | 'C';
  explanation: string;
  bank_group_id?: string;
}

/** Full result of a successful generation call. */
export interface PETShortTextsResult {
  items: ShortTextItem[];
  framingText: string;
}

/** Per-item answer result returned after submit. */
export interface ShortTextAnswerResult {
  number: number;
  chosen: 'A' | 'B' | 'C';
  correct_option: 'A' | 'B' | 'C';
  isCorrect: boolean;
  explanation: string;
}

/** Full submit result. */
export interface PETShortTextsSubmitResult {
  sessionId: string;
  correctCount: number;
  total: number;
  results: ShortTextAnswerResult[];
}

const FRAMING_FALLBACK =
  'You will read 5 short texts (notices, emails, messages, postcards). For each one, choose the meaning that fits best, A, B or C.';

/** Reads one pregenerated set of 5 short-text items from the bank; no model call and no session row. */
export async function generatePETShortTextsAction(): Promise<ActionResult<PETShortTextsResult>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');
  const picked = await pickPlan({
    exam: 'pet',
    cefr: 'b1',
    examPart: 'pet_reading_part1',
    skill: 'reading',
    schema: PetShortTextsPlanSchema,
    userId,
  });
  if (!picked.ok) return picked;
  const framingText = await getPrompt('cambridge_pet_reading_part1_b1_framing').catch(() => FRAMING_FALLBACK);
  const items = picked.data.plan.items.map((item) => ({ ...item, bank_group_id: picked.data.groupId }));
  return ok({ items, framingText });
}

/** Evaluates student answers deterministically (no LLM); creates the session on this first turn and closes it. */
export async function submitPETShortTextsAnswersAction(input: {
  sessionId?: string;
  framingText: string;
  answers: Record<number, 'A' | 'B' | 'C'>;
  items: ShortTextItem[];
}): Promise<PETShortTextsSubmitResult | { error: string }> {
  const results: ShortTextAnswerResult[] = input.items.map((item) => {
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
    mode: 'cambridge_pet_reading_part1',
    sessionId: input.sessionId,
    bank: bankStamp('pet_reading_part1', input.items[0]?.bank_group_id),
    plan: { kind: 'reading_prompt', items: input.items, framing_text: input.framingText },
    answers: results.map((r) => ({
      kind: 'reading_answer',
      item_number: r.number,
      chosen: r.chosen,
      isCorrect: r.isCorrect,
    })),
    evaluation: { kind: 'reading_evaluation', score: correctCount, score_max: total, results },
  });
  if (!completed.ok) return { error: completed.code };

  return { sessionId: completed.data.sessionId, correctCount, total, results };
}
