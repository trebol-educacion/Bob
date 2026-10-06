'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { PetSituationalPlanSchema, type PetSituationalPlan } from '@/lib/bank-plans/pet-listening-part1';
import { bankStamp, pickPlan } from '@/lib/item-bank/plan-bank';
import { fail, ok, type ActionResult } from '@/lib/result';
import { completeActivity } from '@/lib/session/complete';
import { currentUserId } from '@/lib/session/lifecycle';
import { sealPlan, unsealPlan } from '@/lib/session/sealed-plan';

const EXAM_PART = 'pet_listening_part1';
const FRAMING_FALLBACK =
  'Vas a escuchar varias conversaciones cortas de la vida diaria entre dos personas. Después de cada una, elige la respuesta correcta, A, B o C.';

export type PETConversationTurn = PetSituationalPlan['items'][number]['conversation'][number];
export type PETSituationalItem = PetSituationalPlan['items'][number];

/** A single PET Listening Part 1 item without the answer key, plus its audio URL. */
export interface PETSituationalClientItem {
  number: number;
  conversation: PETConversationTurn[];
  question: string;
  options: { A: string; B: string; C: string };
  audio_url: string;
}

/** Full result returned from generatePETListeningSituationalAction. */
export interface PETListeningSituationalResult {
  planToken: string;
  framingText: string;
  context: string;
  items: PETSituationalClientItem[];
}

/** Per-item deterministic result after submit. */
export interface PETSituationalItemResult {
  number: number;
  chosen: 'A' | 'B' | 'C';
  correct_answer: 'A' | 'B' | 'C';
  is_correct: boolean;
}

/** Full submit result. */
export interface PETListeningSituationalSubmitResult {
  sessionId: string;
  correct_count: number;
  total: number;
  item_results: PETSituationalItemResult[];
}

export async function generatePETListeningSituationalAction(): Promise<ActionResult<PETListeningSituationalResult>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');

  const picked = await pickPlan({
    exam: 'pet',
    cefr: 'b1',
    examPart: EXAM_PART,
    skill: 'listening',
    schema: PetSituationalPlanSchema,
    userId,
  });
  if (!picked.ok) return picked;

  const framingText = await getPrompt('cambridge_pet_listening_part1_b1_framing').catch(() => FRAMING_FALLBACK);
  const { plan, groupId } = picked.data;
  const sealed = {
    kind: 'pet_listening_situational_plan',
    framing_text: framingText,
    context: plan.context,
    items: plan.items,
    ...bankStamp(EXAM_PART, groupId),
  };

  return ok({
    planToken: sealPlan(sealed, userId),
    framingText,
    context: plan.context,
    items: plan.items.map((item) => ({
      number: item.number,
      conversation: item.conversation,
      question: item.question,
      options: item.options,
      audio_url: item.audio_url,
    })),
  });
}

/**
 * Evaluates answers deterministically against the server-side answer key and
 * creates the session on this first turn and closes it. No LLM involved.
 */
export async function submitPETListeningSituationalAction(input: {
  sessionId?: string;
  planToken: string;
  answers: Record<number, 'A' | 'B' | 'C'>;
}): Promise<PETListeningSituationalSubmitResult | { error: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'unauthenticated' };
  const plan = unsealPlan<{ items?: Array<{ number: number; answer: 'A' | 'B' | 'C' }> }>(input.planToken, userId);
  const planItems = plan?.items;
  if (!planItems || planItems.length === 0) return { error: 'Could not load exercise' };

  const item_results: PETSituationalItemResult[] = planItems.map((item) => {
    const chosen = input.answers[item.number] ?? 'A';
    return {
      number: item.number,
      chosen,
      correct_answer: item.answer,
      is_correct: chosen === item.answer,
    };
  });

  const correct_count = item_results.filter((r) => r.is_correct).length;
  const total = planItems.length;

  const completed = await completeActivity({
    mode: 'cambridge_pet_listening_part1',
    sessionId: input.sessionId,
    plan,
    answers: item_results.map((r) => ({
      kind: 'pet_listening_situational_answer',
      item_number: r.number,
      chosen: r.chosen,
      is_correct: r.is_correct,
    })),
    evaluation: {
      kind: 'pet_listening_situational_evaluation',
      score: correct_count,
      score_max: total,
      item_results,
    },
  });
  if (!completed.ok) return { error: completed.code };

  return { sessionId: completed.data.sessionId, correct_count, total, item_results };
}
