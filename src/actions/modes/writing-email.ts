'use server';

import { pickPlan } from '@/lib/item-bank/plan-bank';
import { ToeflEmailPlanSchema } from '@/lib/bank-plans/toefl-writing';
import { toEmailTask, type WritingTask } from '@/lib/toefl/writing-task';
import { currentUserId } from '@/lib/session/lifecycle';
import { fail, ok, type ActionResult } from '@/lib/result';
import { evaluateAndSaveOpenWriting, type OpenWritingOutcome } from '@/lib/writing/open-writing';

interface EvaluateEmailInput {
  text: string;
  sessionId?: string;
  exam_part: string;
  instructions: string;
  targetWordCount: [number, number];
  task?: Record<string, unknown>;
  bankGroupId?: string;
}

/** Reads one pregenerated email scenario from the bank; no model call and no session row. */
export async function getEmailTaskAction(): Promise<ActionResult<WritingTask>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');
  const picked = await pickPlan({
    exam: 'toefl',
    cefr: 'b1',
    examPart: 'toefl_writing_email',
    skill: 'writing',
    schema: ToeflEmailPlanSchema,
    userId,
  });
  if (!picked.ok) return picked;
  return ok(toEmailTask(picked.data.plan, picked.data.groupId));
}

/** Evaluates an email writing task by rubric and saves the session on this first turn; returns formative feedback. */
export async function evaluateEmailAction(input: EvaluateEmailInput): Promise<OpenWritingOutcome | { error: string }> {
  const outcome = await evaluateAndSaveOpenWriting({
    text: input.text,
    sessionId: input.sessionId,
    mode: input.exam_part,
    examPart: input.exam_part,
    targetWordCount: input.targetWordCount,
    instructions: input.instructions,
    examinerRole: 'Cambridge/TOEFL writing examiner',
    task: input.task,
    bankGroupId: input.bankGroupId,
  });
  return outcome.ok ? outcome.data : { error: outcome.code };
}
