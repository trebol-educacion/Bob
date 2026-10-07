'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { bankStamp, pickPlan } from '@/lib/item-bank/plan-bank';
import { PetEmailPlanSchema } from '@/lib/bank-plans/pet-writing-part1';
import { fail, ok, type ActionResult } from '@/lib/result';
import { completeActivity } from '@/lib/session/complete';
import { currentUserId } from '@/lib/session/lifecycle';
import { MODELS } from '@/lib/models';

export interface PETEmailPrompt {
  emailReceived: { from: string; subject: string; body: string };
  contentPoints: [string, string, string, string];
  wordTarget: number;
  context: string;
  framingText: string;
  bankGroupId?: string;
}

export interface PETEmailFeedback {
  sessionId?: string;
  understood: boolean;
  highlights: string[];
  suggestions: string[];
  contentPointsCovered: [boolean, boolean, boolean, boolean];
  modelAnswer: string | null;
  rubric?: z.infer<typeof RubricSchema>;
}

const RubricSchema = z
  .object({
    task_coverage: z.number().int().min(0).max(4),
    grammar:       z.number().int().min(0).max(4),
    vocabulary:    z.number().int().min(0).max(4),
    fluency:       z.number().int().min(0).max(4),
  })
  .optional();

const EvaluationSchema = z.object({
  understood:             z.boolean(),
  highlights:             z.array(z.string()),
  suggestions:            z.array(z.string()),
  content_points_covered: z.array(z.boolean()).length(4),
  model_answer:           z.string().nullable().optional(),
  rubric:                 RubricSchema,
});

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

const FRAMING_FALLBACK =
  'You will write an email reply in English. Bob will show you the email you received and 4 things you must include in your answer. Write about 100 words.';

/** Reads one pregenerated PET Writing Part 1 email scenario from the bank; no model call and no session row. */
export async function generatePETEmailAction(): Promise<ActionResult<PETEmailPrompt>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');
  const picked = await pickPlan({
    exam: 'pet',
    cefr: 'b1',
    examPart: 'pet_writing_part1',
    skill: 'writing',
    schema: PetEmailPlanSchema,
    userId,
  });
  if (!picked.ok) return picked;
  const plan = picked.data.plan;
  const framingText = await getPrompt('cambridge_pet_writing_part1_b1_framing').catch(() => FRAMING_FALLBACK);
  return ok({
    emailReceived: plan.email_received,
    contentPoints: plan.content_points as [string, string, string, string],
    wordTarget: plan.word_target,
    context: plan.context,
    framingText,
    bankGroupId: picked.data.groupId,
  });
}

/** Evaluates the student's email reply; creates the session and closes it only when the evaluation succeeds. */
export async function evaluatePETEmailAction(input: {
  sessionId?: string;
  emailReceived: { from: string; subject: string; body: string };
  contentPoints: [string, string, string, string];
  wordTarget: number;
  context: string;
  framingText: string;
  bankGroupId?: string;
  userText: string;
}): Promise<PETEmailFeedback | { error: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'unauthenticated' };

  const emailReceivedStr = `From: ${input.emailReceived.from}\nSubject: ${input.emailReceived.subject}\n\n${input.emailReceived.body}`;
  const contentPointsStr = input.contentPoints.map((p, i) => `${i + 1}. ${p}`).join('\n');

  let evalPromptText: string;
  try {
    evalPromptText = await getPrompt('cambridge_pet_writing_part1_b1_evaluation', {
      EMAIL_RECEIVED: emailReceivedStr,
      CONTENT_POINTS: contentPointsStr,
      USER_TEXT: input.userText,
    });
  } catch {
    return { error: 'evaluation_unavailable' };
  }

  const result = await callGemini(
    { promptKey: 'cambridge_pet_writing_part1_b1_evaluation', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: evalPromptText }] }],
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      })
  );

  if (!isOk(result)) return { error: 'evaluation_failed' };

  const rawText = result.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(EvaluationSchema, rawText);
  if (!parsed) return { error: 'evaluation_failed' };

  const feedback: PETEmailFeedback = {
    understood: parsed.understood,
    highlights: parsed.highlights,
    suggestions: parsed.suggestions,
    contentPointsCovered: parsed.content_points_covered as [boolean, boolean, boolean, boolean],
    modelAnswer: parsed.model_answer ?? null,
    rubric: parsed.rubric,
  };

  const completed = await completeActivity({
    mode: 'cambridge_pet_writing_part1',
    sessionId: input.sessionId,
    bank: bankStamp('pet_writing_part1', input.bankGroupId),
    plan: {
      kind: 'pet_writing_prompt',
      email_received: input.emailReceived,
      content_points: input.contentPoints,
      word_target: input.wordTarget,
      context: input.context,
      framing_text: input.framingText,
    },
    answers: [{ kind: 'writing_submission', text: input.userText }],
    evaluation: { ...feedback, rubric: parsed.rubric ?? null },
  });
  if (!completed.ok) return { error: completed.code };

  return { ...feedback, sessionId: completed.data.sessionId };
}
