'use server';

import { pickPlan } from '@/lib/item-bank/plan-bank';
import { ToeflBuildSentencePlanSchema } from '@/lib/bank-plans/toefl-build-sentence';
import { toBuildSentenceItems, type BuildSentenceBankItem } from '@/lib/toefl/build-sentence-bank';
import { currentUserId } from '@/lib/session/lifecycle';
import { fail, ok, type ActionResult } from '@/lib/result';

export interface BuildSentenceSet {
  items: BuildSentenceBankItem[];
  bankGroupId: string;
}

/** Reads one pregenerated Build a Sentence set from the bank; no model call and no session row. */
export async function getBuildSentenceItemsAction(): Promise<ActionResult<BuildSentenceSet>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');
  const picked = await pickPlan({
    exam: 'toefl',
    cefr: 'b1',
    examPart: 'toefl_writing_build_sentence',
    skill: 'writing',
    schema: ToeflBuildSentencePlanSchema,
    userId,
  });
  if (!picked.ok) return picked;
  return ok({ items: toBuildSentenceItems(picked.data.plan, picked.data.groupId), bankGroupId: picked.data.groupId });
}
