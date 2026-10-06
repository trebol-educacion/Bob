'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { pickPlan, bankStamp } from '@/lib/item-bank/plan-bank';
import { fail, ok, type ActionResult } from '@/lib/result';
import { KetShortTalksPlanSchema, KET_CHAR_KEYS, type KetShortTalksPlan } from '@/lib/bank-plans/ket-listening-part4';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';
import { stripDashes } from '@/lib/text';

export type CharKey = (typeof KET_CHAR_KEYS)[number];

export type Person = KetShortTalksPlan['people'][number];
export type Characteristic = KetShortTalksPlan['characteristics'][number];

export interface ShortTalksExercise {
  people: Person[];
  characteristics: Characteristic[];
  bank_group_id?: string;
}

export interface ShortTalksResult {
  framing_text: string;
  exercise: ShortTalksExercise;
}

export interface ShortTalksPlan {
  framing_text: string;
  people: Person[];
  characteristics: Characteristic[];
  bank_group_id: string;
}

export interface PersonResult {
  number: number;
  name: string;
  chosen: CharKey | null;
  correct_key: CharKey;
  is_correct: boolean;
}

export interface ShortTalksSubmitResult {
  sessionId: string;
  correct_count: number;
  total: number;
  person_results: PersonResult[];
  characteristics: Characteristic[];
}

const FRAMING_FALLBACK =
  'You will hear five people talking about themselves. Match each person to the correct description, A to H. There are three descriptions you do not need.';

export async function generateKETShortTalksPlanAction(): Promise<ActionResult<ShortTalksPlan>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');

  const picked = await pickPlan({
    exam: 'ket',
    cefr: 'a2',
    examPart: 'ket_listening_part4',
    skill: 'listening',
    schema: KetShortTalksPlanSchema,
    userId,
  });
  if (!picked.ok) return picked;

  const framingText = await getPrompt('cambridge_ket_listening_part4_a2_framing').catch(() => FRAMING_FALLBACK);
  return ok({ framing_text: stripDashes(framingText), ...picked.data.plan, bank_group_id: picked.data.groupId });
}

export async function submitKETShortTalksAction(input: {
  sessionId?: string;
  framing_text: string;
  answers: Record<number, CharKey | null>;
  exercise: ShortTalksExercise;
}): Promise<ShortTalksSubmitResult | { error: string }> {
  const person_results: PersonResult[] = input.exercise.people.map((p) => {
    const chosen = input.answers[p.number] ?? null;
    return {
      number: p.number,
      name: p.name,
      chosen,
      correct_key: p.correct_key,
      is_correct: chosen === p.correct_key,
    };
  });

  const correct_count = person_results.filter((r) => r.is_correct).length;

  const completed = await completeActivity({
    mode: 'cambridge_ket_listening_part4',
    sessionId: input.sessionId,
    bank: bankStamp('ket_listening_part4', input.exercise.bank_group_id),
    plan: { kind: 'short_talks_plan', framing_text: input.framing_text, exercise: input.exercise },
    answers: person_results.map((r) => ({
        kind: 'short_talks_answer',
        person_number: r.number,
        chosen: r.chosen,
        is_correct: r.is_correct,
      })),
    evaluation: {
      kind: 'short_talks_evaluation',
      score: correct_count,
      score_max: input.exercise.people.length,
      person_results,
      characteristics: input.exercise.characteristics,
      is_final: true,
    },
  });
  if (!completed.ok) return { error: completed.code };

  return {
    sessionId: completed.data.sessionId,
    correct_count,
    total: input.exercise.people.length,
    person_results,
    characteristics: input.exercise.characteristics,
  };
}
