'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { bankStamp, pickPlan } from '@/lib/item-bank/plan-bank';
import { PetChallengePlanSchema } from '@/lib/bank-plans/pet-writing-challenge';
import { fail, ok, type ActionResult } from '@/lib/result';
import { completeActivity } from '@/lib/session/complete';
import { currentUserId } from '@/lib/session/lifecycle';
import { MODELS } from '@/lib/models';

const FALLBACK_FRAMING =
  'Te propongo un reto de escritura corto. Bob te dará un punto de partida y unos puntos para guiarte. Escribe entre 60 y 100 palabras en inglés. Anímate y escribe con tus propias palabras.';

/** A generated B1 PET Writing Challenge: one of email reply, online review, or story continuation. */
export interface PETWritingChallengePrompt {
  format: 'email' | 'review' | 'story';
  title: string;
  theme: string;
  stimulus: string;
  task: string;
  guidePoints: string[];
  minWords: number;
  maxWords: number;
  framingText: string;
  bankGroupId?: string;
}

/** A single vocabulary improvement suggestion tied to a word the student used. */
export interface VocabularySuggestion {
  original: string;
  suggestion: string;
  example: string;
}

/** A single gentle grammar note with a corrected sentence. */
export interface GrammarNote {
  note: string;
  corrected: string;
}

/** Formative, three-step feedback for a Writing Challenge submission. Never contains a numeric score. */
export interface PETWritingChallengeFeedback {
  sessionId?: string;
  kind: 'formative';
  motivation: string;
  vocabulary: VocabularySuggestion[];
  grammar: GrammarNote[];
}

const EvaluationSchema = z.object({
  kind: z.literal('formative').default('formative'),
  motivation: z.string(),
  vocabulary: z
    .array(
      z.object({
        original: z.string(),
        suggestion: z.string(),
        example: z.string().default(''),
      })
    )
    .default([]),
  grammar: z
    .array(
      z.object({
        note: z.string(),
        corrected: z.string().default(''),
      })
    )
    .default([]),
});

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try {
    return schema.parse(JSON.parse(raw));
  } catch (err) {
    console.warn(
      JSON.stringify({
        event: 'pet_writing_challenge_safeparse_error',
        error: err instanceof Error ? err.message : String(err),
        rawPreview: raw.slice(0, 300),
      })
    );
    return null;
  }
}

/** Reads one pregenerated B1 PET Writing Challenge from the bank; no model call and no session row. */
export async function generatePETWritingChallengeAction(): Promise<ActionResult<PETWritingChallengePrompt>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');
  const picked = await pickPlan({
    exam: 'pet',
    cefr: 'b1',
    examPart: 'pet_writing_challenge',
    skill: 'writing',
    schema: PetChallengePlanSchema,
    userId,
  });
  if (!picked.ok) return picked;
  const plan = picked.data.plan;
  const framingText = await getPrompt('cambridge_pet_writing_challenge_b1_framing').catch(() => FALLBACK_FRAMING);
  return ok({
    format: plan.format,
    title: plan.title,
    theme: plan.theme,
    stimulus: plan.stimulus,
    task: plan.task,
    guidePoints: plan.guide_points,
    minWords: plan.min_words,
    maxWords: plan.max_words,
    framingText,
    bankGroupId: picked.data.groupId,
  });
}

/** Evaluates the student's Writing Challenge text; creates the session and closes it only when the evaluation succeeds. */
export async function submitPETWritingChallengeAction(input: {
  sessionId?: string;
  prompt: PETWritingChallengePrompt;
  userText: string;
}): Promise<PETWritingChallengeFeedback | { error: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'unauthenticated' };

  let evalPromptText: string;
  try {
    evalPromptText = await getPrompt('cambridge_pet_writing_challenge_b1_evaluation', {
      TASK: input.prompt.task,
      USER_TEXT: input.userText,
    });
  } catch {
    return { error: 'evaluation_unavailable' };
  }

  const result = await callGemini(
    { promptKey: 'cambridge_pet_writing_challenge_b1_evaluation', model: MODELS.FLASH_LITE_PREVIEW, userId },
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

  const feedback: PETWritingChallengeFeedback = {
    kind: 'formative',
    motivation: parsed.motivation,
    vocabulary: parsed.vocabulary,
    grammar: parsed.grammar,
  };

  const completed = await completeActivity({
    mode: 'cambridge_pet_writing_challenge',
    sessionId: input.sessionId,
    bank: bankStamp('pet_writing_challenge', input.prompt.bankGroupId),
    plan: {
      kind: 'pet_writing_challenge_prompt',
      format: input.prompt.format,
      title: input.prompt.title,
      theme: input.prompt.theme,
      stimulus: input.prompt.stimulus,
      task: input.prompt.task,
      guide_points: input.prompt.guidePoints,
      min_words: input.prompt.minWords,
      max_words: input.prompt.maxWords,
      framing_text: input.prompt.framingText,
    },
    answers: [{ kind: 'writing_submission', text: input.userText }],
    evaluation: { ...feedback },
  });
  if (!completed.ok) return { error: completed.code };

  return { ...feedback, sessionId: completed.data.sessionId };
}
