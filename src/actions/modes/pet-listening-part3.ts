'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { isAcceptedAnswer } from '@/lib/answer-match';
import { PetGapFillPlanSchema, type PetGapFillPlan } from '@/lib/bank-plans/pet-listening-part3';
import { bankStamp, pickPlan } from '@/lib/item-bank/plan-bank';
import { fail, ok, type ActionResult } from '@/lib/result';
import { completeActivity } from '@/lib/session/complete';
import { currentUserId } from '@/lib/session/lifecycle';
import { sealPlan, unsealPlan } from '@/lib/session/sealed-plan';

const EXAM_PART = 'pet_listening_part3';
const FRAMING_FALLBACK =
  'Vas a escuchar una charla corta de una sola persona. Después, completa el resumen escribiendo o arrastrando la palabra que falta en cada hueco.';

type GenerationGap = PetGapFillPlan['gaps'][number];

/** A gap as sent to the client: number only, never the answer key. */
export interface PETGapFillClientGap {
  number: number;
}

/** A single PET Listening Part 3 gap-fill exercise without the answer key. */
export interface PETGapFillExercise {
  context: string;
  summary_title: string;
  summary: string;
  gaps: PETGapFillClientGap[];
  word_bank: string[];
  audio_url: string;
}

/** Full result returned from generatePETListeningGapFillAction. */
export interface PETListeningGapFillResult {
  planToken: string;
  framingText: string;
  exercise: PETGapFillExercise;
}

/** Per-gap deterministic result after submit. */
export interface PETGapFillGapResult {
  number: number;
  user_input: string;
  correct_answer: string;
  is_correct: boolean;
}

/** Full submit result. */
export interface PETListeningGapFillSubmitResult {
  sessionId: string;
  correct_count: number;
  total: number;
  gap_results: PETGapFillGapResult[];
}

/** Accepts the input if it equals the canonical answer or any listed alternative, case- and accent-insensitive. */
function isAccepted(userInput: string, gap: GenerationGap): boolean {
  return isAcceptedAnswer(userInput, [gap.answer, ...gap.accept]);
}

export async function generatePETListeningGapFillAction(): Promise<ActionResult<PETListeningGapFillResult>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');

  const picked = await pickPlan({
    exam: 'pet',
    cefr: 'b1',
    examPart: EXAM_PART,
    skill: 'listening',
    schema: PetGapFillPlanSchema,
    userId,
  });
  if (!picked.ok) return picked;

  const framingText = await getPrompt('cambridge_pet_listening_part3_b1_framing').catch(() => FRAMING_FALLBACK);
  const { plan, groupId } = picked.data;
  const sealed = {
    kind: 'pet_listening_gapfill_plan',
    framing_text: framingText,
    exercise: {
      context: plan.context,
      summary_title: plan.summary_title,
      transcript: plan.transcript,
      summary: plan.summary,
      gaps: plan.gaps,
      word_bank: plan.word_bank,
      audio_url: plan.audio_url,
    },
    ...bankStamp(EXAM_PART, groupId),
  };

  return ok({
    planToken: sealPlan(sealed, userId),
    framingText,
    exercise: {
      context: plan.context,
      summary_title: plan.summary_title,
      summary: plan.summary,
      gaps: plan.gaps.map((gap) => ({ number: gap.number })),
      word_bank: plan.word_bank,
      audio_url: plan.audio_url,
    },
  });
}

/**
 * Evaluates answers deterministically against the server-side answer key and
 * persists results. No LLM involved; the key is re-read from the persisted plan.
 */
export async function submitPETListeningGapFillAction(input: {
  sessionId?: string;
  planToken: string;
  answers: Record<number, string>;
}): Promise<PETListeningGapFillSubmitResult | { error: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'unauthenticated' };
  const plan = unsealPlan<{ exercise?: { gaps?: GenerationGap[] } }>(input.planToken, userId);
  const planGaps = plan?.exercise?.gaps;
  if (!planGaps || planGaps.length === 0) return { error: 'Could not load exercise' };

  const gap_results: PETGapFillGapResult[] = planGaps.map((gap) => {
    const user_input = (input.answers[gap.number] ?? '').trim();
    return {
      number: gap.number,
      user_input,
      correct_answer: gap.answer,
      is_correct: isAccepted(user_input, gap),
    };
  });

  const correct_count = gap_results.filter((r) => r.is_correct).length;
  const total = planGaps.length;

  const completed = await completeActivity({
    mode: 'cambridge_pet_listening_part3',
    sessionId: input.sessionId,
    plan,
    answers: gap_results.map((r) => ({
      kind: 'pet_listening_gapfill_answer',
      gap_number: r.number,
      user_input: r.user_input,
      is_correct: r.is_correct,
    })),
    evaluation: {
      kind: 'pet_listening_gapfill_evaluation',
      score: correct_count,
      score_max: total,
      gap_results,
    },
  });
  if (!completed.ok) return { error: completed.code };

  return { sessionId: completed.data.sessionId, correct_count, total, gap_results };
}
