'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { PetJustifyPlanSchema, type PetJustifyPlan } from '@/lib/bank-plans/pet-listening-part5';
import { bankStamp, pickPlan } from '@/lib/item-bank/plan-bank';
import { fail, ok, type ActionResult } from '@/lib/result';
import { completeActivity } from '@/lib/session/complete';
import { currentUserId } from '@/lib/session/lifecycle';
import { sealPlan, unsealPlan } from '@/lib/session/sealed-plan';

const EXAM_PART = 'pet_listening_part5';
const FRAMING_FALLBACK =
  'Vas a escuchar una entrevista. Lee cada frase y decide si es Verdadera o Falsa según lo que oyes. Si marcas Falsa, elige también por qué es falsa entre las opciones.';

export type WhyKey = 'A' | 'B' | 'C';

export type PETJustifyAudioTurn = PetJustifyPlan['audio'][number];
export type PETJustifyStatement = PetJustifyPlan['statements'][number];

/** A single statement as sent to the client: keeps why_options for the UI but never the keys. */
export interface PETJustifyClientStatement {
  number: number;
  text: string;
  why_options?: { A: string; B: string; C?: string };
}

/** Full result returned from generatePETListeningTrueFalseJustifyAction. */
export interface PETListeningTrueFalseJustifyResult {
  planToken: string;
  framingText: string;
  context: string;
  audio: PETJustifyAudioTurn[];
  audio_url: string;
  statements: PETJustifyClientStatement[];
}

/** Per-statement deterministic result after submit. */
export interface PETJustifyStatementResult {
  number: number;
  text: string;
  chosen_verdict: 'T' | 'F' | null;
  correct_verdict: 'T' | 'F';
  verdict_correct: boolean;
  why_options?: { A: string; B: string; C?: string };
  chosen_why: WhyKey | null;
  correct_why: WhyKey | null;
  why_correct: boolean | null;
  points: number;
  points_max: number;
}

/** Full submit result. */
export interface PETListeningTrueFalseJustifySubmitResult {
  sessionId: string;
  score: number;
  score_max: number;
  correct_count: number;
  total: number;
  statement_results: PETJustifyStatementResult[];
  audio: PETJustifyAudioTurn[];
}

interface ClientAnswer {
  verdict: 'T' | 'F' | null;
  why?: WhyKey | null;
}

export async function generatePETListeningTrueFalseJustifyAction(): Promise<ActionResult<PETListeningTrueFalseJustifyResult>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');

  const picked = await pickPlan({
    exam: 'pet',
    cefr: 'b1',
    examPart: EXAM_PART,
    skill: 'listening',
    schema: PetJustifyPlanSchema,
    userId,
  });
  if (!picked.ok) return picked;

  const framingText = await getPrompt('cambridge_pet_listening_part5_b1_framing').catch(() => FRAMING_FALLBACK);
  const { plan, groupId } = picked.data;
  const sealed = {
    kind: 'pet_listening_tf_justify_plan',
    framing_text: framingText,
    context: plan.context,
    audio: plan.audio,
    audio_url: plan.audio_url,
    statements: plan.statements,
    ...bankStamp(EXAM_PART, groupId),
  };

  return ok({
    planToken: sealPlan(sealed, userId),
    framingText,
    context: plan.context,
    audio: plan.audio,
    audio_url: plan.audio_url,
    statements: plan.statements.map((s) => ({
      number: s.number,
      text: s.text,
      ...(s.why_options ? { why_options: s.why_options } : {}),
    })),
  });
}

/**
 * Evaluates answers deterministically against the server-side keys re-read from
 * the persisted plan, then creates the session on this first turn and closes it. No LLM involved. Scoring convention:
 * each statement is worth 1 point for a true statement (correct verdict), and 2
 * points for a false statement, 1 for the correct verdict plus 1 for the correct
 * justification, only awarded when the verdict was also right. correct_count
 * counts statements fully right (verdict, and justification when false).
 */
export async function submitPETListeningTrueFalseJustifyAction(input: {
  sessionId?: string;
  planToken: string;
  answers: Record<number, ClientAnswer>;
}): Promise<PETListeningTrueFalseJustifySubmitResult | { error: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'unauthenticated' };
  const plan = unsealPlan<{
    audio?: PETJustifyAudioTurn[];
    statements?: PETJustifyStatement[];
  }>(input.planToken, userId);
  const planStatements = plan?.statements;
  const audio = plan?.audio ?? [];
  if (!planStatements || planStatements.length === 0) return { error: 'Could not load exercise' };

  const statement_results: PETJustifyStatementResult[] = planStatements.map((s) => {
    const correct_verdict: 'T' | 'F' = s.is_true ? 'T' : 'F';
    const answer = input.answers[s.number] ?? { verdict: null };
    const chosen_verdict = answer.verdict ?? null;
    const verdict_correct = chosen_verdict === correct_verdict;

    if (s.is_true) {
      return {
        number: s.number,
        text: s.text,
        chosen_verdict,
        correct_verdict,
        verdict_correct,
        chosen_why: null,
        correct_why: null,
        why_correct: null,
        points: verdict_correct ? 1 : 0,
        points_max: 1,
      };
    }

    const correct_why = (s.why_correct ?? null) as WhyKey | null;
    const chosen_why = answer.why ?? null;
    const why_correct = verdict_correct ? chosen_why === correct_why : false;

    return {
      number: s.number,
      text: s.text,
      chosen_verdict,
      correct_verdict,
      verdict_correct,
      ...(s.why_options ? { why_options: s.why_options } : {}),
      chosen_why,
      correct_why,
      why_correct,
      points: (verdict_correct ? 1 : 0) + (why_correct ? 1 : 0),
      points_max: 2,
    };
  });

  const score = statement_results.reduce((acc, r) => acc + r.points, 0);
  const score_max = statement_results.reduce((acc, r) => acc + r.points_max, 0);
  const correct_count = statement_results.filter(
    (r) => r.verdict_correct && (r.correct_verdict === 'T' || r.why_correct === true)
  ).length;
  const total = planStatements.length;

  const completed = await completeActivity({
    mode: 'cambridge_pet_listening_part5',
    sessionId: input.sessionId,
    plan,
    answers: statement_results.map((r) => ({
      kind: 'pet_listening_tf_justify_answer',
      statement_number: r.number,
      chosen_verdict: r.chosen_verdict,
      chosen_why: r.chosen_why,
      verdict_correct: r.verdict_correct,
      why_correct: r.why_correct,
      points: r.points,
    })),
    evaluation: {
      kind: 'pet_listening_tf_justify_evaluation',
      score,
      score_max,
      correct_count,
      total,
      statement_results,
      audio,
    },
  });
  if (!completed.ok) return { error: completed.code };

  return { sessionId: completed.data.sessionId, score, score_max, correct_count, total, statement_results, audio };
}
