'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { stripDashes } from '@/lib/text';
import { pickPlan, bankStamp } from '@/lib/item-bank/plan-bank';
import { fail, ok, type ActionResult } from '@/lib/result';
import { KetListenCompletePlanSchema, type KetListenCompletePlan } from '@/lib/bank-plans/ket-listening-part2';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';
import { normalizeAnswer } from '@/lib/answer-match';

export type Gap = KetListenCompletePlan['gaps'][number];

export interface ListenCompleteExercise extends KetListenCompletePlan {
  bank_group_id?: string;
}

export interface ListenCompleteResult {
  framing_text: string;
  exercise: ListenCompleteExercise;
}

export interface GapResult {
  number: number;
  label: string;
  user_input: string;
  correct_answer: string;
  is_correct: boolean;
}

export interface ListenCompleteSubmitResult {
  sessionId: string;
  correct_count: number;
  total: number;
  gap_results: GapResult[];
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Accepts exact matches and minor typos (distance ≤ 1 for short answers, ≤ 2 for longer). */
function isAccepted(userInput: string, answer: string): boolean {
  const a = normalizeAnswer(userInput);
  const b = normalizeAnswer(answer);
  if (a === b) return true;
  const maxDistance = b.length <= 5 ? 1 : 2;
  return levenshtein(a, b) <= maxDistance;
}

const FRAMING_FALLBACK =
  'You will hear someone speaking. Listen and complete the form below. Write ONE word, number, date or time in each gap.';

export async function generateKETListenCompleteAction(): Promise<ActionResult<ListenCompleteResult>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');

  const picked = await pickPlan({
    exam: 'ket',
    cefr: 'a2',
    examPart: 'ket_listening_part2',
    skill: 'listening',
    schema: KetListenCompletePlanSchema,
    userId,
  });
  if (!picked.ok) return picked;

  const framingText = await getPrompt('cambridge_ket_listening_part2_a2_framing').catch(() => FRAMING_FALLBACK);
  return ok({
    framing_text: stripDashes(framingText),
    exercise: { ...picked.data.plan, bank_group_id: picked.data.groupId },
  });
}

export async function submitKETListenCompleteAction(input: {
  sessionId?: string;
  framing_text: string;
  answers: Record<number, string>;
  exercise: ListenCompleteExercise;
}): Promise<ListenCompleteSubmitResult | { error: string }> {
  const gap_results: GapResult[] = input.exercise.gaps.map((gap) => {
    const user_input = (input.answers[gap.number] ?? '').trim();
    return {
      number: gap.number,
      label: stripDashes(gap.label),
      user_input,
      correct_answer: stripDashes(gap.answer),
      is_correct: isAccepted(user_input, gap.answer),
    };
  });

  const correct_count = gap_results.filter((r) => r.is_correct).length;

  const completed = await completeActivity({
    mode: 'cambridge_ket_listening_part2',
    sessionId: input.sessionId,
    bank: bankStamp('ket_listening_part2', input.exercise.bank_group_id),
    plan: { kind: 'listen_complete_plan', framing_text: input.framing_text, exercise: input.exercise },
    answers: gap_results.map((r) => ({
        kind: 'listen_complete_answer',
        gap_number: r.number,
        user_input: r.user_input,
        is_correct: r.is_correct,
      })),
    evaluation: {
      kind: 'listen_complete_evaluation',
      score: correct_count,
      score_max: input.exercise.gaps.length,
      gap_results,
      is_final: true,
    },
  });
  if (!completed.ok) return { error: completed.code };

  return {
    sessionId: completed.data.sessionId, correct_count, total: input.exercise.gaps.length, gap_results };
}
