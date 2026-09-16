'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { persistMessage } from '@/lib/persist-activity';
import { createSessionAction } from '@/actions/sessions';
import { createSupabaseServer } from '@/lib/supabase/server';
import { MODELS } from '@/lib/models';

const FALLBACK_FRAMING =
  'Te propongo un reto de escritura corto. Bob te dará un punto de partida y unos puntos para guiarte. Escribe entre 60 y 100 palabras en inglés. Anímate y escribe con tus propias palabras.';

/** A generated B1 PET Writing Challenge: one of email reply, online review, or story continuation. */
export interface PETWritingChallengePrompt {
  sessionId: string;
  userId: string;
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

function buildFallbackFeedback(): PETWritingChallengeFeedback {
  return {
    kind: 'formative',
    motivation: 'Great effort finishing your text! Have a look and try again to keep improving.',
    vocabulary: [],
    grammar: [],
  };
}

/** Generates a B1 PET Writing Challenge and framing text; creates a session if none provided. */
export async function generatePETWritingChallengeAction(input: {
  sessionId?: string;
  userId?: string;
}): Promise<PETWritingChallengePrompt | { error: string }> {
  let sessionId = input.sessionId;
  let userId = input.userId;

  if (!sessionId) {
    const result = await createSessionAction({
      mode: 'cambridge_pet_writing_challenge',
      title: 'Writing Challenge',
    });
    if (!result.data) {
      return { error: result.error ?? 'Could not create session' };
    }
    sessionId = result.data.id;
    userId = result.data.user_id;
  } else if (!userId) {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };
    userId = user.id;
  }

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
        sessionId,
        rawPreview: rawText.slice(0, 500),
      })
    );
    return { error: 'Unexpected response from the model' };
  }

  persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'text',
    contentText: null,
    contentJson: {
      kind: 'pet_writing_challenge_prompt',
      format: parsed.format,
      title: parsed.title,
      theme: parsed.theme,
      stimulus: parsed.stimulus,
      task: parsed.task,
      guide_points: parsed.guide_points,
      min_words: parsed.min_words,
      max_words: parsed.max_words,
      framing_text: framingText,
    },
  }).catch(() => undefined);

  return {
    sessionId,
    userId,
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

/** Evaluates the student's Writing Challenge text and persists formative three-step feedback. */
export async function submitPETWritingChallengeAction(input: {
  sessionId: string;
  userId: string;
  task: string;
  userText: string;
}): Promise<PETWritingChallengeFeedback | { error: string }> {
  const fallback = buildFallbackFeedback();

  let evalPromptText: string;
  try {
    evalPromptText = await getPrompt('cambridge_pet_writing_challenge_b1_evaluation', {
      TASK: input.task,
      USER_TEXT: input.userText,
    });
  } catch {
    persistMessage({
      sessionId: input.sessionId,
      userId: input.userId,
      role: 'bob',
      msgType: 'evaluation',
      contentJson: { ...fallback, is_final: true },
    }).catch(() => undefined);
    return fallback;
  }

  persistMessage({
    sessionId: input.sessionId,
    userId: input.userId,
    role: 'user',
    msgType: 'text',
    contentText: input.userText,
    contentJson: { kind: 'writing_submission', text: input.userText },
  }).catch(() => undefined);

  const result = await callGemini(
    { promptKey: 'cambridge_pet_writing_challenge_b1_evaluation', model: MODELS.FLASH_LITE_PREVIEW, userId: input.userId },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: evalPromptText }] }],
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      })
  );

  if (!isOk(result)) {
    persistMessage({
      sessionId: input.sessionId,
      userId: input.userId,
      role: 'bob',
      msgType: 'evaluation',
      contentJson: { ...fallback, is_final: true },
    }).catch(() => undefined);
    return fallback;
  }

  const rawText = result.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(EvaluationSchema, rawText);

  if (!parsed) {
    persistMessage({
      sessionId: input.sessionId,
      userId: input.userId,
      role: 'bob',
      msgType: 'evaluation',
      contentJson: { ...fallback, is_final: true },
    }).catch(() => undefined);
    return fallback;
  }

  const feedback: PETWritingChallengeFeedback = {
    kind: 'formative',
    motivation: parsed.motivation,
    vocabulary: parsed.vocabulary,
    grammar: parsed.grammar,
  };

  persistMessage({
    sessionId: input.sessionId,
    userId: input.userId,
    role: 'bob',
    msgType: 'evaluation',
    contentJson: { ...feedback, is_final: true },
  }).catch(() => undefined);

  return feedback;
}
