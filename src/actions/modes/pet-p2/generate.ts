'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { pickPlan } from '@/lib/item-bank/plan-bank';
import { PetPicturePlanSchema } from '@/lib/bank-plans/pet-p2';
import { fail, ok, type ActionResult } from '@/lib/result';
import { currentUserId } from '@/lib/session/lifecycle';
import type { PETPictureDescriptionResult } from './contracts';

/** Reads one pregenerated PET Part 2 scene with its photograph from the bank; no model, image or session call. */
export async function generatePETPictureDescriptionAction(): Promise<ActionResult<PETPictureDescriptionResult>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');

  const picked = await pickPlan({
    exam: 'pet',
    cefr: 'b1',
    examPart: 'pet_p2',
    skill: 'speaking',
    schema: PetPicturePlanSchema,
    userId,
  });
  if (!picked.ok) return picked;

  const plan = picked.data.plan;
  const framingText = await getPrompt('cambridge_pet_p2_b1_framing').catch(() => '');
  return ok({
    topic: plan.topic,
    framingText,
    scenePrompt: plan.scene_prompt,
    referenceVocabulary: plan.reference_vocabulary,
    languageBank: plan.language_bank,
    imageUrl: plan.image_url,
    bankGroupId: picked.data.groupId,
  });
}
