'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { persistMessage } from '@/lib/persist-activity';
import { createSessionAction } from '@/actions/sessions';
import { createSupabaseServer } from '@/lib/supabase/server';
import { MODELS } from '@/lib/models';

export interface EssayNote {
  id: number;
  label: string;
  description: string;
}

export interface FCEEssayPrompt {
  sessionId: string;
  userId: string;
  title: string;
  essayQuestion: string;
  context: string;
  notes: [EssayNote, EssayNote, EssayNote];
  wordTargetMin: 140;
  wordTargetMax: 190;
  framingText: string;
}

export interface FCEEssayFeedback {
  understood: boolean;
  highlights: string[];
  suggestions: string[];
  notesCovered: [boolean, boolean, boolean];
  organization: 'OK' | 'Good' | 'Excellent';
  register: 'OK' | 'Good' | 'Excellent';
  modelAnswer: string | null;
  rubric?: z.infer<typeof RubricSchema>;
}

const GenerationSchema = z.object({
  title: z.string(),
  essay_question: z.string(),
  context: z.string(),
  notes: z
    .array(
      z.object({
        id: z.number(),
        label: z.string(),
        description: z.string(),
      })
    )
    .length(3),
  word_target_min: z.number().default(140),
  word_target_max: z.number().default(190),
});

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
  notes_covered: z.array(z.boolean()).length(3),
  organization:  z.enum(['OK', 'Good', 'Excellent']),
  register:      z.enum(['OK', 'Good', 'Excellent']),
  model_answer:  z.string().nullable().optional(),
  rubric:        RubricSchema,
});

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try {
    return schema.parse(JSON.parse(raw));
  } catch (err) {
    console.warn(
      JSON.stringify({
        event: 'fce_writing_part1_safeparse_error',
        error: err instanceof Error ? err.message : String(err),
        rawPreview: raw.slice(0, 300),
      })
    );
    return null;
  }
}

function buildFallbackFeedback(): FCEEssayFeedback {
  return {
    understood: false,
    highlights: [],
    suggestions: ['Please try again.'],
    notesCovered: [false, false, false],
    organization: 'OK',
    register: 'OK',
    modelAnswer: null,
  };
}

/** Generates an FCE Writing Part 1 essay task; creates a session if none provided. */
export async function generateFCEEssayAction(input: {
  sessionId?: string;
  userId?: string;
}): Promise<FCEEssayPrompt | { error: string }> {
  let sessionId = input.sessionId;
  let userId = input.userId;

  if (!sessionId) {
    const result = await createSessionAction({
      mode: 'cambridge_fce_writing_part1',
      title: 'Writing Part 1 — Essay',
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
    getPrompt('cambridge_fce_writing_part1_b2_generation').catch(() => null),
    getPrompt('cambridge_fce_writing_part1_b2_framing').catch(
      () =>
        'You will write a balanced essay in English (140-190 words). Bob will give you a title with two notes and one space for your own idea. Discuss both sides if relevant and finish with a conclusion. Use semi-formal language: firstly, moreover, however, in conclusion.'
    ),
  ]);

  if (!generationPrompt) {
    return { error: 'Could not load generation prompt' };
  }

  const result = await callGemini(
    {
      promptKey: 'cambridge_fce_writing_part1_b2_generation',
      model: MODELS.FLASH_LITE_PREVIEW,
      userId,
    },
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

  const rawText =
    result.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(GenerationSchema, rawText);

  if (!parsed) {
    console.error(
      JSON.stringify({
        event: 'fce_writing_part1_generate_parse_failed',
        sessionId,
        rawPreview: rawText.slice(0, 500),
      })
    );
    return { error: 'Unexpected response from the model' };
  }

  const notes = parsed.notes as [EssayNote, EssayNote, EssayNote];

  persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'text',
    contentText: null,
    contentJson: {
      kind: 'essay_prompt',
      title: parsed.title,
      essay_question: parsed.essay_question,
      context: parsed.context,
      notes,
      word_target_min: parsed.word_target_min,
      word_target_max: parsed.word_target_max,
      framing_text: framingText,
    },
  }).catch(() => undefined);

  return {
    sessionId,
    userId,
    title: parsed.title,
    essayQuestion: parsed.essay_question,
    context: parsed.context,
    notes,
    wordTargetMin: 140,
    wordTargetMax: 190,
    framingText,
  };
}

/** Evaluates the student's essay and persists qualitative formative feedback. */
export async function evaluateFCEEssayAction(input: {
  sessionId: string;
  userId: string;
  title: string;
  notes: [EssayNote, EssayNote, EssayNote];
  userText: string;
}): Promise<FCEEssayFeedback | { error: string }> {
  const fallback = buildFallbackFeedback();

  const wordCount = input.userText.trim() === ''
    ? 0
    : input.userText.trim().split(/\s+/).length;

  const notesJoined = input.notes
    .map((n) => `${n.id}. ${n.label}: ${n.description}`)
    .join('\n');

  let evalPromptText: string;
  try {
    evalPromptText = await getPrompt(
      'cambridge_fce_writing_part1_b2_evaluation',
      {
        ESSAY_TITLE: input.title,
        NOTES_JOINED: notesJoined,
        USER_TEXT: input.userText,
        WORD_COUNT: String(wordCount),
      }
    );
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
    {
      promptKey: 'cambridge_fce_writing_part1_b2_evaluation',
      model: MODELS.FLASH_LITE_PREVIEW,
      userId: input.userId,
    },
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

  const rawText =
    result.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
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

  const feedback: FCEEssayFeedback = {
    understood: parsed.understood,
    highlights: parsed.highlights,
    suggestions: parsed.suggestions,
    notesCovered: parsed.notes_covered as [boolean, boolean, boolean],
    organization: parsed.organization,
    register: parsed.register,
    modelAnswer: parsed.model_answer ?? null,
    rubric: parsed.rubric,
  };

  persistMessage({
    sessionId: input.sessionId,
    userId: input.userId,
    role: 'bob',
    msgType: 'evaluation',
    contentJson: { ...feedback, rubric: parsed.rubric ?? null, is_final: true },
  }).catch(() => undefined);

  return feedback;
}
