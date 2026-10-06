'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { pickPlan, bankStamp } from '@/lib/item-bank/plan-bank';
import { fail, ok, type ActionResult } from '@/lib/result';
import { KetMatchPlanSchema, type KetMatchPlan } from '@/lib/bank-plans/ket-reading-part2';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';

export type ReadingText = KetMatchPlan['texts'][number];
export type MatchQuestion = KetMatchPlan['questions'][number];

export interface MatchExercise extends KetMatchPlan {
  bank_group_id?: string;
}

export interface MatchResult {
  framing_text: string;
  exercise: MatchExercise;
}

export interface QuestionResult {
  number: number;
  chosen: 'A' | 'B' | 'C' | null;
  correct_answer: 'A' | 'B' | 'C';
  is_correct: boolean;
}

export interface MatchSubmitResult {
  sessionId: string;
  correct_count: number;
  total: number;
  question_results: QuestionResult[];
}

const FRAMING_FALLBACK = 'Read the three texts. Then match each question to the correct person, A, B or C.';

export async function generateKETMatchQuestionAction(): Promise<ActionResult<MatchResult>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');

  const picked = await pickPlan({
    exam: 'ket',
    cefr: 'a2',
    examPart: 'ket_reading_part2',
    skill: 'reading',
    schema: KetMatchPlanSchema,
    userId,
  });
  if (!picked.ok) return picked;

  const framingText = await getPrompt('cambridge_ket_reading_part2_a2_framing').catch(() => FRAMING_FALLBACK);
  return ok({ framing_text: framingText, exercise: { ...picked.data.plan, bank_group_id: picked.data.groupId } });
}

export async function submitKETMatchQuestionAction(input: {
  sessionId?: string;
  framing_text: string;
  exercise: MatchExercise;
  answers: Record<number, 'A' | 'B' | 'C' | null>;
}): Promise<MatchSubmitResult | { error: string }> {
  const question_results: QuestionResult[] = input.exercise.questions.map((q) => {
    const chosen = input.answers[q.number] ?? null;
    return { number: q.number, chosen, correct_answer: q.answer, is_correct: chosen === q.answer };
  });

  const correct_count = question_results.filter((r) => r.is_correct).length;

  const completed = await completeActivity({
    mode: 'cambridge_ket_reading_part2',
    sessionId: input.sessionId,
    bank: bankStamp('ket_reading_part2', input.exercise.bank_group_id),
    plan: { kind: 'reading_match_plan', framing_text: input.framing_text, exercise: input.exercise },
    answers: question_results.map((r) => ({ kind: 'reading_match_answer', question_number: r.number, chosen: r.chosen, is_correct: r.is_correct })),
    evaluation: { kind: 'reading_match_evaluation', score: correct_count, score_max: input.exercise.questions.length, question_results, is_final: true },
  });
  if (!completed.ok) return { error: completed.code };

  return { sessionId: completed.data.sessionId, correct_count, total: input.exercise.questions.length, question_results };
}
