'use server';

import { pickPlan } from '@/lib/item-bank/plan-bank';
import { ToeflAcademicPlanSchema } from '@/lib/bank-plans/toefl-writing';
import { toAcademicTask, type WritingTask } from '@/lib/toefl/writing-task';
import { currentUserId } from '@/lib/session/lifecycle';
import { fail, ok, type ActionResult } from '@/lib/result';
import { evaluateAndSaveOpenWriting, type OpenWritingOutcome } from '@/lib/writing/open-writing';

interface EvaluateAcademicInput {
  text: string;
  sessionId?: string;
  exam_part: string;
  instructions: string;
  targetWordCount: [number, number];
  task?: Record<string, unknown>;
  bankGroupId?: string;
}

/** Reads one pregenerated discussion thread from the bank; no model call and no session row. */
export async function getAcademicTaskAction(): Promise<ActionResult<WritingTask>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');
  const picked = await pickPlan({
    exam: 'toefl',
    cefr: 'b1',
    examPart: 'toefl_writing_academic_discussion',
    skill: 'writing',
    schema: ToeflAcademicPlanSchema,
    userId,
  });
  if (!picked.ok) return picked;
  return ok(toAcademicTask(picked.data.plan, picked.data.groupId));
}

/** Evaluates an academic discussion post by rubric and saves the session on this first turn; returns formative feedback. */
export async function evaluateAcademicAction(input: EvaluateAcademicInput): Promise<OpenWritingOutcome | { error: string }> {
  const outcome = await evaluateAndSaveOpenWriting({
    text: input.text,
    sessionId: input.sessionId,
    mode: input.exam_part,
    examPart: input.exam_part,
    targetWordCount: input.targetWordCount,
    instructions: input.instructions,
    examinerRole: 'Cambridge/TOEFL academic writing examiner',
    task: input.task,
    bankGroupId: input.bankGroupId,
  });
  return outcome.ok ? outcome.data : { error: outcome.code };
}
