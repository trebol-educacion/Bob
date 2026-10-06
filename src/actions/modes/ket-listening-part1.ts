'use server';

import { stripDashes } from '@/lib/text';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { pickPlan, bankStamp } from '@/lib/item-bank/plan-bank';
import { fail, ok, type ActionResult } from '@/lib/result';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';
import { KetListenChoosePlanSchema, type KetListenChoosePlan } from '@/lib/bank-plans/ket-listening-part1';

export type ListenDialogueTurn = KetListenChoosePlan['items'][number]['dialogue'][number];
export type ListenOption = KetListenChoosePlan['items'][number]['options'][number];

/** A single Listen and Choose item with resolved image URLs and audio. */
export interface ListenItem {
  number: number;
  context: string;
  dialogue: ListenDialogueTurn[];
  question: string;
  options: ListenOption[];
  correct_option: 'A' | 'B' | 'C';
  audio_url: string;
  bank_group_id?: string;
}

/** Full result returned from generateKETListenAndChooseAction. */
export interface KETListeningResult {
  framingText: string;
  items: ListenItem[];
}

/** Per-item result after submit. */
export interface ListenAnswerResult {
  number: number;
  chosen: 'A' | 'B' | 'C';
  correct_option: 'A' | 'B' | 'C';
  isCorrect: boolean;
  dialogue: ListenDialogueTurn[];
}

/** Full submit result. */
export interface KETListenSubmitResult {
  sessionId: string;
  correctCount: number;
  total: number;
  results: ListenAnswerResult[];
}

const FRAMING_FALLBACK =
  'You will hear 5 short conversations. After each one, choose the picture that matches what you heard, A, B or C.';

export async function generateKETListenAndChooseAction(): Promise<ActionResult<KETListeningResult>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');

  const picked = await pickPlan({
    exam: 'ket',
    cefr: 'a2',
    examPart: 'ket_listening_part1',
    skill: 'listening',
    schema: KetListenChoosePlanSchema,
    userId,
  });
  if (!picked.ok) return picked;

  const framingText = await getPrompt('cambridge_ket_listening_part1_a2_framing').catch(() => FRAMING_FALLBACK);
  const items = picked.data.plan.items.map((item) => ({ ...item, bank_group_id: picked.data.groupId }));
  return ok({ framingText: stripDashes(framingText), items });
}

/**
 * Evaluates answers deterministically and persists results.
 * No LLM involved, correct_option is embedded in each item.
 */
export async function submitKETListenAnswersAction(input: {
  sessionId?: string;
  framingText: string;
  answers: Record<number, 'A' | 'B' | 'C'>;
  items: ListenItem[];
}): Promise<KETListenSubmitResult | { error: string }> {
  const results: ListenAnswerResult[] = input.items.map((item) => {
    const chosen = input.answers[item.number] ?? 'A';
    return {
      number: item.number,
      chosen,
      correct_option: item.correct_option,
      isCorrect: chosen === item.correct_option,
      dialogue: item.dialogue,
    };
  });

  const correctCount = results.filter((r) => r.isCorrect).length;
  const total = input.items.length;

  const completed = await completeActivity({
    mode: 'cambridge_ket_listening_part1',
    sessionId: input.sessionId,
    bank: bankStamp('ket_listening_part1', input.items[0]?.bank_group_id),
    plan: {
      kind: 'listening_plan',
      framing_text: input.framingText,
      items: input.items.map((item) => ({
        number: item.number,
        context: item.context,
        dialogue: item.dialogue,
        question: item.question,
        options: item.options,
        correct_option: item.correct_option,
        audio_url: item.audio_url,
      })),
    },
    answers: results.map((r) => ({ kind: 'listening_answer', item_number: r.number, chosen: r.chosen, isCorrect: r.isCorrect })),
    evaluation: { kind: 'listening_evaluation', score: correctCount, score_max: total, results },
  });
  if (!completed.ok) return { error: completed.code };

  return { sessionId: completed.data.sessionId, correctCount, total, results };
}
