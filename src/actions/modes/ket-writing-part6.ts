'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';
import { MODELS } from '@/lib/models';
import { stripDashes } from '@/lib/text';
import { bankStamp, pickPlan } from '@/lib/item-bank/plan-bank';
import { fail, ok, type ActionResult } from '@/lib/result';
import { KetShortMessagePlanSchema } from '@/lib/bank-plans/ket-writing-part6';

const KET_SHORT_MESSAGE_PART = 'ket_writing_part6';

export interface KETShortMessagePrompt {
  scenario: string;
  recipient: string;
  contentPoints: string[];
  wordTarget: number;
  framingText: string;
  bankGroupId?: string;
}

export interface KETShortMessageEvaluation {
  sessionId: string;
  feedback: KETShortMessageFeedback;
}

export interface KETShortMessageFeedback {
  understood: boolean;
  highlights: string[];
  suggestions: string[];
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
  understood:    z.boolean(),
  highlights:    z.array(z.string()),
  suggestions:   z.array(z.string()),
  model_answer:  z.string().nullable().optional(),
  rubric:        RubricSchema,
});

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

const FRAMING_FALLBACK = 'Vas a escribir un mensaje corto a un amigo en inglés. Escribe unas 25 palabras.';

/** Reads one pregenerated Part 6 scenario from the bank; no model call and no session row. */
export async function generateKETShortMessageAction(): Promise<ActionResult<KETShortMessagePrompt>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');

  const picked = await pickPlan({
    exam: 'ket',
    cefr: 'a2',
    examPart: KET_SHORT_MESSAGE_PART,
    skill: 'writing',
    schema: KetShortMessagePlanSchema,
    userId,
  });
  if (!picked.ok) return picked;

  const plan = picked.data.plan;
  const framingText = await getPrompt('cambridge_ket_writing_part6_a2_framing').catch(() => FRAMING_FALLBACK);
  return ok({
    scenario: plan.scenario,
    recipient: plan.recipient,
    contentPoints: plan.content_points,
    wordTarget: plan.word_target,
    framingText,
    bankGroupId: picked.data.groupId,
  });
}

/** Evaluates the short message first; the session is created and closed only when the evaluation succeeds. */
export async function evaluateKETShortMessageAction(input: {
  sessionId?: string;
  prompt: KETShortMessagePrompt;
  userText: string;
}): Promise<KETShortMessageEvaluation | { error: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'unauthenticated' };

  const contentPointsFormatted = input.prompt.contentPoints
    .map((p, i) => `${i + 1}. ${p}`)
    .join('\n');

  let evalPromptText: string;
  try {
    evalPromptText = await getPrompt('cambridge_ket_writing_part6_a2_evaluation', {
      SCENARIO: input.prompt.scenario,
      CONTENT_POINTS: contentPointsFormatted,
      USER_TEXT: input.userText,
    });
  } catch {
    return { error: 'evaluation_unavailable' };
  }

  let parsed: z.infer<typeof EvaluationSchema> | null = null;
  for (let attempt = 0; attempt < 3 && !parsed; attempt++) {
    const result = await callGemini(
      { promptKey: 'cambridge_ket_writing_part6_a2_evaluation', model: MODELS.FLASH_LITE_PREVIEW, userId },
      (ai) =>
        ai.models.generateContent({
          model: MODELS.FLASH_LITE_PREVIEW,
          contents: [{ role: 'user', parts: [{ text: evalPromptText }] }],
          config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
        })
    );
    if (!isOk(result)) continue;
    const rawText = result.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    parsed = safeParse(EvaluationSchema, rawText);
  }

  if (!parsed) return { error: 'evaluation_failed' };

  const feedback: KETShortMessageFeedback = {
    understood: parsed.understood,
    highlights: parsed.highlights.map((h) => stripDashes(h)),
    suggestions: parsed.suggestions.map((s) => stripDashes(s)),
    modelAnswer: parsed.model_answer ? stripDashes(parsed.model_answer) : null,
    rubric: parsed.rubric,
  };

  const completed = await completeActivity({
    mode: 'cambridge_ket_writing_part6',
    sessionId: input.sessionId,
    bank: bankStamp(KET_SHORT_MESSAGE_PART, input.prompt.bankGroupId),
    plan: {
      kind: 'writing_prompt',
      scenario: input.prompt.scenario,
      recipient: input.prompt.recipient,
      content_points: input.prompt.contentPoints,
      word_target: input.prompt.wordTarget,
      framing_text: input.prompt.framingText,
    },
    answers: [],
    answerTexts: [{ contentText: input.userText, contentJson: { kind: 'writing_submission', text: input.userText } }],
    evaluation: { ...feedback, rubric: parsed.rubric ?? null },
  });
  if (!completed.ok) return { error: completed.code };

  return { sessionId: completed.data.sessionId, feedback };
}
