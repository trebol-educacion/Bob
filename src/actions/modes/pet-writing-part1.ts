'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { persistMessage } from '@/lib/persist-activity';
import { createSessionAction } from '@/actions/sessions';
import { createSupabaseServer } from '@/lib/supabase/server';
import { MODELS } from '@/lib/models';

export interface PETEmailPrompt {
  sessionId: string;
  userId: string;
  emailReceived: { from: string; subject: string; body: string };
  contentPoints: [string, string, string, string];
  wordTarget: number;
  context: string;
  framingText: string;
}

export interface PETEmailFeedback {
  understood: boolean;
  highlights: string[];
  suggestions: string[];
  contentPointsCovered: [boolean, boolean, boolean, boolean];
  modelAnswer: string | null;
}

const GenerationSchema = z.object({
  email_received: z.object({
    from: z.string(),
    subject: z.string(),
    body: z.string(),
  }),
  content_points: z.array(z.string()).length(4),
  word_target: z.number().default(100),
  context: z.string().default(''),
});

const EvaluationSchema = z.object({
  understood: z.boolean(),
  highlights: z.array(z.string()),
  suggestions: z.array(z.string()),
  content_points_covered: z.array(z.boolean()).length(4),
  model_answer: z.string().nullable().optional(),
});

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try {
    return schema.parse(JSON.parse(raw));
  } catch (err) {
    console.warn(JSON.stringify({
      event: 'pet_writing_part1_safeparse_error',
      error: err instanceof Error ? err.message : String(err),
      rawPreview: raw.slice(0, 300),
    }));
    return null;
  }
}

function buildFallbackFeedback(): PETEmailFeedback {
  return {
    understood: false,
    highlights: [],
    suggestions: ['Please try again.'],
    contentPointsCovered: [false, false, false, false],
    modelAnswer: null,
  };
}

/** Generates a PET Writing Part 1 email scenario and framing text; creates a session if none provided. */
export async function generatePETEmailAction(input: {
  sessionId?: string;
  userId?: string;
}): Promise<PETEmailPrompt | { error: string }> {
  let sessionId = input.sessionId;
  let userId = input.userId;

  if (!sessionId) {
    const result = await createSessionAction({
      mode: 'cambridge_pet_writing_part1',
      title: 'PET Writing Part 1 — Email',
    });
    if (!result.data) {
      return { error: result.error ?? 'Could not create session' };
    }
    sessionId = result.data.id;
    userId = result.data.user_id;
  } else if (!userId) {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };
    userId = user.id;
  }

  const [generationPrompt, framingText] = await Promise.all([
    getPrompt('cambridge_pet_writing_part1_b1_generation').catch(() => null),
    getPrompt('cambridge_pet_writing_part1_b1_framing').catch(
      () =>
        'You will write an email reply in English. Bob will show you the email you received and 4 things you must include in your answer. Write about 100 words.'
    ),
  ]);

  if (!generationPrompt) {
    return { error: 'Could not load generation prompt' };
  }

  const result = await callGemini(
    { promptKey: 'cambridge_pet_writing_part1_b1_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
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
    console.error(JSON.stringify({
      event: 'pet_writing_part1_generate_parse_failed',
      sessionId,
      rawPreview: rawText.slice(0, 500),
    }));
    return { error: 'Unexpected response from the model' };
  }

  const contentPoints = parsed.content_points as [string, string, string, string];

  persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'text',
    contentText: null,
    contentJson: {
      kind: 'pet_writing_prompt',
      email_received: parsed.email_received,
      content_points: contentPoints,
      word_target: parsed.word_target,
      context: parsed.context,
      framing_text: framingText,
    },
  }).catch(() => undefined);

  return {
    sessionId,
    userId,
    emailReceived: parsed.email_received,
    contentPoints,
    wordTarget: parsed.word_target,
    context: parsed.context,
    framingText,
  };
}

/** Evaluates the student's email reply and persists qualitative formative feedback. */
export async function evaluatePETEmailAction(input: {
  sessionId: string;
  userId: string;
  emailReceived: { from: string; subject: string; body: string };
  contentPoints: [string, string, string, string];
  userText: string;
}): Promise<PETEmailFeedback | { error: string }> {
  const fallback = buildFallbackFeedback();

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
    { promptKey: 'cambridge_pet_writing_part1_b1_evaluation', model: MODELS.FLASH_LITE_PREVIEW, userId: input.userId },
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

  const feedback: PETEmailFeedback = {
    understood: parsed.understood,
    highlights: parsed.highlights,
    suggestions: parsed.suggestions,
    contentPointsCovered: parsed.content_points_covered as [boolean, boolean, boolean, boolean],
    modelAnswer: parsed.model_answer ?? null,
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
