'use server';

import { pickPlan } from '@/lib/item-bank/plan-bank';
import { fail, ok, type ActionResult } from '@/lib/result';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';
import { evaluateKetAudio } from '@/lib/speaking/ket-evaluate';
import {
  HOBBY_FEEDBACK_KIND,
  HOBBY_PLAN_KIND,
  HobbyPlanSchema,
  type HobbyPlan,
  type KetSpeakingFeedback,
} from '@/lib/speaking/ket-speaking';

const HOBBY_MODE = 'cambridge_ket_part2';
const HOBBY_PART = 'ket_part2';

export type HobbyTalkFeedback = KetSpeakingFeedback;

/** Reads one pregenerated hobby prompt with its picture and instruction audio from the bank; no model, TTS or image call. */
export async function generateKETHobbyTalkPlanAction(): Promise<ActionResult<HobbyPlan>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');

  const picked = await pickPlan({
    exam: 'ket',
    cefr: 'a2',
    examPart: HOBBY_PART,
    skill: 'speaking',
    schema: HobbyPlanSchema,
    userId,
  });
  if (!picked.ok) return picked;
  return ok({ ...picked.data.plan, exam_part: HOBBY_PART, bank_group_id: picked.data.groupId });
}

export async function evaluateKETHobbyTalkAction(input: {
  sessionId?: string;
  plan: HobbyPlan;
  audioBase64: string;
  audioMime: string;
}): Promise<{ feedback: HobbyTalkFeedback; sessionId: string } | { error: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'unauthenticated' };

  const evaluated = await evaluateKetAudio({
    promptKey: 'cambridge_ket_part2_a2_evaluation',
    replacements: {
      '{HOBBY}': input.plan.hobby,
      '{BULLET_POINTS}': input.plan.bullet_points.map((b, i) => `${i + 1}. ${b}`).join('; '),
      '{TRANSCRIPT}': '[audio attached]',
    },
    audioBase64: input.audioBase64,
    audioMime: input.audioMime,
    userId,
  });
  if (!evaluated.ok) return { error: evaluated.code };

  const completed = await completeActivity({
    mode: HOBBY_MODE,
    sessionId: input.sessionId,
    plan: { kind: HOBBY_PLAN_KIND, ...input.plan },
    answers: [{ kind: 'speaking_answer', question: input.plan.instruction }],
    evaluation: { kind: HOBBY_FEEDBACK_KIND, ...evaluated.data, rubric: evaluated.data.rubric ?? null },
  });
  if (!completed.ok) return { error: completed.code };

  return { feedback: evaluated.data, sessionId: completed.data.sessionId };
}
