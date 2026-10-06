'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { stripDashes } from '@/lib/text';
import { pickPlan, bankStamp } from '@/lib/item-bank/plan-bank';
import { fail, ok, type ActionResult } from '@/lib/result';
import { KetTfdsPlanSchema, type KetTfdsPlan } from '@/lib/bank-plans/ket-listening-part5';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';

export type Verdict = 'T' | 'F' | 'DS';

export type AudioTurn = KetTfdsPlan['audio'][number];
export type Statement = KetTfdsPlan['statements'][number];

export interface TFDSExercise extends KetTfdsPlan {
  bank_group_id?: string;
}

export interface TFDSResult {
  framing_text: string;
  exercise: TFDSExercise;
}

export interface StatementResult {
  number: number;
  text: string;
  chosen: Verdict | null;
  correct_verdict: Verdict;
  is_correct: boolean;
}

export interface TFDSSubmitResult {
  sessionId: string;
  correct_count: number;
  total: number;
  statement_results: StatementResult[];
  audio: AudioTurn[];
}

const FRAMING_FALLBACK =
  'You will hear someone speaking. Read the statements and decide: is each one True, False, or does the speaker not say? Choose T, F or DS for each one.';

export async function generateKETTFDSAction(): Promise<ActionResult<TFDSResult>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');

  const picked = await pickPlan({
    exam: 'ket',
    cefr: 'a2',
    examPart: 'ket_listening_part5',
    skill: 'listening',
    schema: KetTfdsPlanSchema,
    userId,
  });
  if (!picked.ok) return picked;

  const framingText = await getPrompt('cambridge_ket_listening_part5_a2_framing').catch(() => FRAMING_FALLBACK);
  return ok({
    framing_text: stripDashes(framingText),
    exercise: { ...picked.data.plan, bank_group_id: picked.data.groupId },
  });
}

export async function submitKETTFDSAction(input: {
  sessionId?: string;
  framing_text: string;
  answers: Record<number, Verdict | null>;
  exercise: TFDSExercise;
}): Promise<TFDSSubmitResult | { error: string }> {
  const statement_results: StatementResult[] = input.exercise.statements.map((s) => {
    const chosen = input.answers[s.number] ?? null;
    return {
      number: s.number,
      text: s.text,
      chosen,
      correct_verdict: s.verdict,
      is_correct: chosen === s.verdict,
    };
  });

  const correct_count = statement_results.filter((r) => r.is_correct).length;

  const completed = await completeActivity({
    mode: 'cambridge_ket_listening_part5',
    sessionId: input.sessionId,
    bank: bankStamp('ket_listening_part5', input.exercise.bank_group_id),
    plan: { kind: 'tfds_plan', framing_text: input.framing_text, exercise: input.exercise },
    answers: statement_results.map((r) => ({
        kind: 'tfds_answer',
        statement_number: r.number,
        chosen: r.chosen,
        is_correct: r.is_correct,
      })),
    evaluation: {
      kind: 'tfds_evaluation',
      score: correct_count,
      score_max: input.exercise.statements.length,
      statement_results,
      audio: input.exercise.audio,
      is_final: true,
    },
  });
  if (!completed.ok) return { error: completed.code };

  return {
    sessionId: completed.data.sessionId,
    correct_count,
    total: input.exercise.statements.length,
    statement_results,
    audio: input.exercise.audio,
  };
}
