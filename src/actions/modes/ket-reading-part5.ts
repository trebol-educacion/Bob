'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { bankStamp, pickPlan } from '@/lib/item-bank/plan-bank';
import { fail, ok, type ActionResult } from '@/lib/result';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';
import { KetTfdsPlanSchema, type KetStatement, type KetTfdsPlan } from '@/lib/bank-plans/ket-reading-part5';

const KET_TFDS_PART = 'ket_reading_part5';

export type Verdict = 'T' | 'F' | 'DS';

export type ReadingStatement = KetStatement;

export interface ReadingTFDSExercise extends KetTfdsPlan {
  bank_group_id?: string;
}

export interface ReadingTFDSResult {
  framing_text: string;
  exercise: ReadingTFDSExercise;
}

export interface ReadingStatementResult {
  number: number;
  text: string;
  chosen: Verdict | null;
  correct_verdict: Verdict;
  is_correct: boolean;
}

export interface ReadingTFDSSubmitResult {
  sessionId: string;
  correct_count: number;
  total: number;
  statement_results: ReadingStatementResult[];
}

const FRAMING_FALLBACK = "Read the text carefully. Then decide if each statement is True, False, or Doesn't Say, T, F or DS.";

export async function generateKETReadingTFDSAction(): Promise<ActionResult<ReadingTFDSResult>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');

  const picked = await pickPlan({
    exam: 'ket',
    cefr: 'a2',
    examPart: KET_TFDS_PART,
    skill: 'reading',
    schema: KetTfdsPlanSchema,
    userId,
  });
  if (!picked.ok) return picked;

  const framingText = await getPrompt('cambridge_ket_reading_part5_a2_framing').catch(() => FRAMING_FALLBACK);
  return ok({ framing_text: framingText, exercise: { ...picked.data.plan, bank_group_id: picked.data.groupId } });
}

export async function submitKETReadingTFDSAction(input: {
  sessionId?: string;
  framing_text: string;
  exercise: ReadingTFDSExercise;
  answers: Record<number, Verdict | null>;
}): Promise<ReadingTFDSSubmitResult | { error: string }> {
  const statement_results: ReadingStatementResult[] = input.exercise.statements.map((s) => {
    const chosen = input.answers[s.number] ?? null;
    return { number: s.number, text: s.text, chosen, correct_verdict: s.verdict, is_correct: chosen === s.verdict };
  });

  const correct_count = statement_results.filter((r) => r.is_correct).length;

  const completed = await completeActivity({
    mode: 'cambridge_ket_reading_part5',
    sessionId: input.sessionId,
    bank: bankStamp(KET_TFDS_PART, input.exercise.bank_group_id),
    plan: { kind: 'reading_tfds_plan', framing_text: input.framing_text, exercise: input.exercise },
    answers: statement_results.map((r) => ({ kind: 'reading_tfds_answer', statement_number: r.number, chosen: r.chosen, is_correct: r.is_correct })),
    evaluation: { kind: 'reading_tfds_evaluation', score: correct_count, score_max: input.exercise.statements.length, statement_results, is_final: true },
  });
  if (!completed.ok) return { error: completed.code };

  return { sessionId: completed.data.sessionId, correct_count, total: input.exercise.statements.length, statement_results };
}
