'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { bankStamp, loadPlan, pickPlan } from '@/lib/item-bank/plan-bank';
import { fail, ok, type ActionResult } from '@/lib/result';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';
import { stripDashes } from '@/lib/text';
import {
  KetShortConversationsPlanSchema,
  toPublicShortConversations,
  type KetShortConversationPublicItem,
} from '@/lib/bank-plans/ket-listening-part4';
import { gradeShortConversations, type KeyedResult } from '@/lib/ket/listening-grading';

const PART = 'ket_listening_part4';
const FRAMING_FALLBACK = 'You will hear five short conversations. For each one, listen and choose the right answer, A, B or C.';

export interface KetShortConversationsExercise {
  items: KetShortConversationPublicItem[];
  bank_group_id: string;
}

export interface KetShortConversationsStart {
  framing_text: string;
  exercise: KetShortConversationsExercise;
}

export interface KetShortConversationsSubmitResult {
  sessionId: string;
  correct_count: number;
  total: number;
  item_results: KeyedResult[];
}

/** @returns five short conversations from the bank, without keys or transcripts */
export async function startKETShortConversationsAction(): Promise<ActionResult<KetShortConversationsStart>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');

  const picked = await pickPlan({ exam: 'ket', cefr: 'a2', examPart: PART, skill: 'listening', schema: KetShortConversationsPlanSchema, userId });
  if (!picked.ok) return picked;

  const framingText = await getPrompt('cambridge_ket_listening_part4_a2_framing').catch(() => FRAMING_FALLBACK);
  return ok({
    framing_text: stripDashes(framingText),
    exercise: { items: toPublicShortConversations(picked.data.plan), bank_group_id: picked.data.groupId },
  });
}

/**
 * @param input.answers option chosen per item number
 * @returns per-item results graded against the keys stored in the bank
 */
export async function submitKETShortConversationsAction(input: {
  sessionId?: string;
  framing_text: string;
  exercise: KetShortConversationsExercise;
  answers: Record<number, string>;
}): Promise<ActionResult<KetShortConversationsSubmitResult>> {
  const plan = await loadPlan(input.exercise.bank_group_id, KetShortConversationsPlanSchema);
  if (!plan.ok) return plan;

  const item_results = gradeShortConversations(plan.data, input.answers);
  const correct_count = item_results.filter((r) => r.is_correct).length;

  const completed = await completeActivity({
    mode: 'cambridge_ket_listening_part4',
    sessionId: input.sessionId,
    bank: bankStamp(PART, input.exercise.bank_group_id),
    plan: { kind: 'ket_short_conversations_plan', framing_text: input.framing_text, exercise: input.exercise },
    answers: item_results.map((r) => ({ kind: 'ket_short_conversations_answer', item_number: r.number, chosen: r.chosen, is_correct: r.is_correct })),
    evaluation: { kind: 'ket_short_conversations_evaluation', score: correct_count, score_max: item_results.length, item_results, is_final: true },
  });
  if (!completed.ok) return fail(completed.code);

  return ok({ sessionId: completed.data.sessionId, correct_count, total: item_results.length, item_results });
}
