'use server';

import { evaluateAndSaveOpenWriting, type OpenWritingOutcome } from '@/lib/writing/open-writing';

interface EvaluateEmailInput {
  text: string;
  sessionId?: string;
  exam_part: string;
  instructions: string;
  targetWordCount: [number, number];
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
  });
  return outcome.ok ? outcome.data : { error: outcome.code };
}
