import 'server-only';

import type { z } from 'zod';
import { pickPlan } from '@/lib/item-bank/plan-bank';
import { ok, type ActionResult } from '@/lib/result';

/**
 * @param input.schema contract of the stored speaking plan
 * @param input.examPart bank exam part of the plan
 * @param input.userId student, used to avoid recently seen sets
 * @returns the banked plan stamped with its exam part and bank group id, or the bank failure
 */
export async function pickPetPlan<P extends object>(input: {
  schema: z.ZodType<P>;
  examPart: string;
  userId: string;
}): Promise<ActionResult<P & { exam_part: string; bank_group_id: string }>> {
  const picked = await pickPlan({
    exam: 'pet',
    cefr: 'b1',
    examPart: input.examPart,
    skill: 'speaking',
    schema: input.schema,
    userId: input.userId,
  });
  if (!picked.ok) return picked;
  return ok({ ...picked.data.plan, exam_part: input.examPart, bank_group_id: picked.data.groupId });
}
