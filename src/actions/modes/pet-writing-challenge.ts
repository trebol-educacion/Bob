'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
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

const GenerationSchema = z.object({
  format: z.enum(['email', 'review', 'story']),
  title: z.string().default(''),
  theme: z.string().default(''),
  stimulus: z.string(),
  task: z.string(),
  guide_points: z.array(z.string()).min(3).max(4),
  min_words: z.number().default(60),
  max_words: z.number().default(100),
});

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

/** Generates a B1 PET Writing Challenge and framing text; persists nothing until the first submit. */
export async function generatePETWritingChallengeAction(): Promise<PETWritingChallengePrompt | { error: string }> {
  const userId = (await currentUserId()) ?? undefined;

  const [generationPrompt, framingText] = await Promise.all([
    getPrompt('cambridge_pet_writing_challenge_b1_generation').catch(() => null),
    getPrompt('cambridge_pet_writing_challenge_b1_framing').catch(() => FALLBACK_FRAMING),
  ]);

  if (!generationPrompt) {
    return { error: 'Could not load generation prompt' };
  }

  const result = await callGemini(
    { promptKey: 'cambridge_pet_writing_challenge_b1_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: generationPrompt }] }],
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      })
  );

  if (!isOk(result)) {
    return { error: 'Could not generate the exercise' };
  }

  const rawText = result.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(GenerationSchema, rawText);

  if (!parsed) {
    console.error(
      JSON.stringify({
        event: 'pet_writing_challenge_generate_parse_failed',
        rawPreview: rawText.slice(0, 500),
      })
    );
    return { error: 'Unexpected response from the model' };
  }

  return {
    format: parsed.format,
    title: parsed.title,
    theme: parsed.theme,
    stimulus: parsed.stimulus,
    task: parsed.task,
    guidePoints: parsed.guide_points,
    minWords: parsed.min_words,
    maxWords: parsed.max_words,
    framingText,
  };
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
