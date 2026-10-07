'use server';

import { pickPlan } from '@/lib/item-bank/plan-bank';
import { fail, ok, type ActionResult } from '@/lib/result';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';
import { evaluateKetAudio } from '@/lib/speaking/ket-evaluate';
import {
  PICTURE_FEEDBACK_KIND,
  PICTURE_PLAN_KIND,
  PicturePlanSchema,
  type KetSpeakingFeedback,
  type PicturePlan,
} from '@/lib/speaking/ket-speaking';

const PICTURE_MODE = 'cambridge_ket_part3';
const PICTURE_PART = 'ket_part3';

export type PictureDescFeedback = KetSpeakingFeedback;

/** Reads one pregenerated picture prompt with its image and instruction audio from the bank; no model, TTS or image call. */
export async function generateKETPictureDescPlanAction(): Promise<ActionResult<PicturePlan>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');

  const picked = await pickPlan({
    exam: 'ket',
    cefr: 'a2',
    examPart: PICTURE_PART,
    skill: 'speaking',
    schema: PicturePlanSchema,
    userId,
  });
  if (!picked.ok) return picked;
  return ok({ ...picked.data.plan, exam_part: PICTURE_PART, bank_group_id: picked.data.groupId });
}

export async function evaluateKETPictureDescAction(input: {
  sessionId?: string;
  plan: PicturePlan;
  audioBase64: string;
  audioMime: string;
}): Promise<{ feedback: PictureDescFeedback; sessionId: string } | { error: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'unauthenticated' };

  const evaluated = await evaluateKetAudio({
    promptKey: 'cambridge_ket_part3_a2_evaluation',
    replacements: { '{SCENE_DESCRIPTION}': input.plan.scene_description, '{TRANSCRIPT}': '[audio attached]' },
    audioBase64: input.audioBase64,
    audioMime: input.audioMime,
    userId,
  });
  if (!evaluated.ok) return { error: evaluated.code };

  const storedPlan = {
    scene_description: input.plan.scene_description,
    instruction: input.plan.instruction,
    image_prompt: input.plan.image_prompt,
    image_url: input.plan.image_url ?? '',
    instruction_audio_url: input.plan.instruction_audio_url ?? '',
    exam_part: PICTURE_PART,
    bank_group_id: input.plan.bank_group_id,
  };
  const completed = await completeActivity({
    mode: PICTURE_MODE,
    sessionId: input.sessionId,
    plan: { kind: PICTURE_PLAN_KIND, ...storedPlan },
    answers: [{ kind: 'speaking_answer', question: input.plan.instruction }],
    evaluation: { kind: PICTURE_FEEDBACK_KIND, ...evaluated.data, rubric: evaluated.data.rubric ?? null },
  });
  if (!completed.ok) return { error: completed.code };

  return { feedback: evaluated.data, sessionId: completed.data.sessionId };
}
