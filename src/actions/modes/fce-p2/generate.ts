'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { pickContent } from '@/lib/item-bank/content-source';
import { fail, ok, type ActionResult } from '@/lib/result';
import { currentUserId } from '@/lib/session/lifecycle';
import { toLongTurnPlan } from '@/lib/speaking/fce-p2-bank';
import type { FCELongTurnResult } from './contracts';

const FCE_P2_PART = 'fce_speaking_part2';

/** Reads one pregenerated Long Turn task with its two photographs from the bank; no model call and no session row. */
export async function generateFCEPictureDescriptionAction(): Promise<ActionResult<FCELongTurnResult>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');

  const picked = await pickContent({
    framework: 'fce',
    cefr: 'b2',
    examPart: FCE_P2_PART,
    purpose: 'practice',
    groupsOnly: true,
    itemless: true,
    skill: 'speaking',
    userId,
  });
  if (!picked.ok) return picked;

  const framingText = await getPrompt('cambridge_fce_p2_b2_framing').catch(() => '');
  const plan = toLongTurnPlan(picked.data, framingText);
  return plan ? ok(plan) : fail('no_content');
}
