import 'server-only';

import type { z } from 'zod';
import { fail, ok, type ActionResult } from '@/lib/result';
import { pickContent } from './content-source';
import type { ItemBankExam, ItemBankSkill } from './types';

export interface PlanQuery<P> {
  exam: ItemBankExam;
  cefr: string | null;
  examPart: string;
  skill: ItemBankSkill;
  schema: z.ZodType<P>;
  userId?: string;
  topic?: string;
}

export interface PickedPlan<P> {
  plan: P;
  groupId: string;
}

export interface BankStamp {
  exam_part: string;
  bank_group_id: string | null;
}

/**
 * @param query.exam bank exam of the group
 * @param query.schema contract of the stored plan, shared with the pregeneration script
 * @returns a published plan validated against the schema, or `no_content` when the bank has none
 */
export async function pickPlan<P>(query: PlanQuery<P>): Promise<ActionResult<PickedPlan<P>>> {
  const picked = await pickContent({
    framework: query.exam,
    cefr: query.cefr,
    examPart: query.examPart,
    purpose: 'practice',
    skill: query.skill,
    groupsOnly: true,
    itemless: true,
    userId: query.userId,
    topic: query.topic,
  });
  if (!picked.ok) return picked;
  if (picked.data.kind !== 'group') return fail('no_content');
  const parsed = query.schema.safeParse(picked.data.group.metadata.plan);
  if (!parsed.success) return fail('no_content');
  return ok({ plan: parsed.data, groupId: picked.data.group.id });
}

/**
 * @param examPart
 * @param groupId bank group the plan came from
 * @returns fields persisted with the plan so the next pick avoids recent groups
 */
export function bankStamp(examPart: string, groupId: string | null | undefined): BankStamp {
  return { exam_part: examPart, bank_group_id: groupId ?? null };
}
