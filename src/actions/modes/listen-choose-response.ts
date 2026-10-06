'use server';

import { pickPlan } from '@/lib/item-bank/plan-bank';
import { ToeflChooseResponsePlanSchema } from '@/lib/bank-plans/toefl-choose-response';
import { CHOOSE_RESPONSE_PART, toClosedItems } from '@/lib/toefl/choose-response-bank';
import { currentUserId } from '@/lib/session/lifecycle';
import { fail, ok, type ActionResult } from '@/lib/result';
import type { ClosedItem } from '@/lib/types/practice';

export interface ChooseResponseSet {
  items: ClosedItem[];
  bankGroupId: string;
}

/** Reads one pregenerated Listen and Choose a Response set with MP3 audio from the bank; no model or TTS call. */
export async function getClosedItemsAction(): Promise<ActionResult<ChooseResponseSet>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');
  const picked = await pickPlan({
    exam: 'toefl',
    cefr: 'b1',
    examPart: CHOOSE_RESPONSE_PART,
    skill: 'listening',
    schema: ToeflChooseResponsePlanSchema,
    userId,
  });
  if (!picked.ok) return picked;
  return ok({ items: toClosedItems(picked.data.plan, picked.data.groupId), bankGroupId: picked.data.groupId });
}
