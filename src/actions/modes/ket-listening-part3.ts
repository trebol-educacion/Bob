'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { stripDashes } from '@/lib/text';
import { pickPlan, bankStamp } from '@/lib/item-bank/plan-bank';
import { fail, ok, type ActionResult } from '@/lib/result';
import { KetListenDecidePlanSchema, type KetListenDecidePlan } from '@/lib/bank-plans/ket-listening-part3';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';

export type ConversationTurn = KetListenDecidePlan['conversation'][number];
export type ListenDecideItem = KetListenDecidePlan['items'][number];

export interface ListenDecideExercise extends KetListenDecidePlan {
  bank_group_id?: string;
}

export interface ListenDecideResult {
  framing_text: string;
  exercise: ListenDecideExercise;
}

export interface ItemResult {
  number: number;
  chosen: 'A' | 'B' | 'C';
  correct_answer: 'A' | 'B' | 'C';
  is_correct: boolean;
}

export interface ListenDecideSubmitResult {
  sessionId: string;
  correct_count: number;
  total: number;
  item_results: ItemResult[];
  conversation: ConversationTurn[];
}

const FRAMING_FALLBACK =
  'You will hear a conversation between two people. Listen carefully and choose the best answer, A, B or C, for each question.';

export async function generateKETListenDecideAction(): Promise<ActionResult<ListenDecideResult>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');

  const picked = await pickPlan({
    exam: 'ket',
    cefr: 'a2',
    examPart: 'ket_listening_part3',
    skill: 'listening',
    schema: KetListenDecidePlanSchema,
    userId,
  });
  if (!picked.ok) return picked;

  const framingText = await getPrompt('cambridge_ket_listening_part3_a2_framing').catch(() => FRAMING_FALLBACK);
  return ok({
    framing_text: stripDashes(framingText),
    exercise: { ...picked.data.plan, bank_group_id: picked.data.groupId },
  });
}

export async function submitKETListenDecideAction(input: {
  sessionId?: string;
  framing_text: string;
  answers: Record<number, 'A' | 'B' | 'C'>;
  exercise: ListenDecideExercise;
}): Promise<ListenDecideSubmitResult | { error: string }> {
  const item_results: ItemResult[] = input.exercise.items.map((item) => {
    const chosen = input.answers[item.number] ?? 'A';
    return {
      number: item.number,
      chosen,
      correct_answer: item.answer,
      is_correct: chosen === item.answer,
    };
  });

  const correct_count = item_results.filter((r) => r.is_correct).length;

  const completed = await completeActivity({
    mode: 'cambridge_ket_listening_part3',
    sessionId: input.sessionId,
    bank: bankStamp('ket_listening_part3', input.exercise.bank_group_id),
    plan: { kind: 'listen_decide_plan', framing_text: input.framing_text, exercise: input.exercise },
    answers: item_results.map((r) => ({
        kind: 'listen_decide_answer',
        item_number: r.number,
        chosen: r.chosen,
        is_correct: r.is_correct,
      })),
    evaluation: {
      kind: 'listen_decide_evaluation',
      score: correct_count,
      score_max: input.exercise.items.length,
      item_results,
      conversation: input.exercise.conversation,
      is_final: true,
    },
  });
  if (!completed.ok) return { error: completed.code };

  return {
    sessionId: completed.data.sessionId,
    correct_count,
    total: input.exercise.items.length,
    item_results,
    conversation: input.exercise.conversation,
  };
}
