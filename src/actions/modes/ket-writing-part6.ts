'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { persistMessage } from '@/lib/persist-activity';
import { createSessionAction } from '@/actions/sessions';
import { MODELS } from '@/lib/models';
import { stripDashes } from '@/lib/text';

export interface KETShortMessagePrompt {
  sessionId: string;
  userId: string;
  scenario: string;
  recipient: string;
  contentPoints: string[];
  wordTarget: number;
  framingText: string;
}

export interface KETShortMessageFeedback {
  understood: boolean;
  highlights: string[];
  suggestions: string[];
  modelAnswer: string | null;
  rubric?: z.infer<typeof RubricSchema>;
}

const GenerationSchema = z.object({
  scenario: z.string(),
  recipient: z.string(),
  content_points: z.array(z.string()).min(2).max(3),
  word_target: z.number().default(25),
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

function buildFallbackFeedback(): KETShortMessageFeedback {
  return {
    understood: false,
    highlights: [],
    suggestions: ['Por favor vuelve a intentarlo.'],
    modelAnswer: null,
  };
}

/** Generates a KET Writing Part 6 scenario and framing text; creates a session if none provided. */
export async function generateKETShortMessageAction(input: {
  sessionId?: string;
  userId?: string;
}): Promise<KETShortMessagePrompt | { error: string }> {
  let sessionId = input.sessionId;
  let userId = input.userId;

  if (!sessionId) {
    const result = await createSessionAction({
      mode: 'cambridge_ket_writing_part6',
      title: 'Writing Part 6, Short Message',
    });
    if (!result.data) {
      return { error: result.error ?? 'No se pudo crear la sesión' };
    }
    sessionId = result.data.id;
    userId = result.data.user_id;
  }

  if (!userId) {
    return { error: 'userId requerido' };
  }

  const [generationPrompt, framingText] = await Promise.all([
    getPrompt('cambridge_ket_writing_part6_a2_generation').catch(() => null),
    getPrompt('cambridge_ket_writing_part6_a2_framing').catch(
      () => 'Vas a escribir un mensaje corto a un amigo en inglés. Escribe unas 25 palabras.'
    ),
  ]);

  if (!generationPrompt) {
    return { error: 'No se pudo cargar el prompt de generación' };
  }

  let parsed: z.infer<typeof GenerationSchema> | null = null;
  for (let attempt = 0; attempt < 3 && !parsed; attempt++) {
    const result = await callGemini(
      { promptKey: 'cambridge_ket_writing_part6_a2_generation', model: MODELS.FLASH_LITE, userId },
      (ai) =>
        ai.models.generateContent({
          model: MODELS.FLASH_LITE,
          contents: [{ role: 'user', parts: [{ text: generationPrompt }] }],
          config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
        })
    );
    if (!isOk(result)) continue;
    const rawText = result.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    parsed = safeParse(GenerationSchema, rawText);
  }

  if (!parsed) {
    return { error: 'No se pudo generar la consigna' };
  }

  const cleanScenario = stripDashes(parsed.scenario);
  const cleanRecipient = stripDashes(parsed.recipient);
  const cleanContentPoints = parsed.content_points.map((p) => stripDashes(p));
  const cleanFramingText = stripDashes(framingText);

  persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'text',
    contentText: null,
    contentJson: {
      kind: 'writing_prompt',
      scenario: cleanScenario,
      recipient: cleanRecipient,
      content_points: cleanContentPoints,
      word_target: parsed.word_target,
      framing_text: cleanFramingText,
    },
  }).catch(() => undefined);

  return {
    sessionId,
    userId,
    scenario: cleanScenario,
    recipient: cleanRecipient,
    contentPoints: cleanContentPoints,
    wordTarget: parsed.word_target,
    framingText: cleanFramingText,
  };
}

/** Evaluates the student's short message and persists formative feedback. */
export async function evaluateKETShortMessageAction(input: {
  sessionId: string;
  userId: string;
  scenario: string;
  contentPoints: string[];
  userText: string;
}): Promise<KETShortMessageFeedback | { error: string }> {
  const fallback = buildFallbackFeedback();

  const contentPointsFormatted = input.contentPoints
    .map((p, i) => `${i + 1}. ${p}`)
    .join('\n');

  let evalPromptText: string;
  try {
    evalPromptText = await getPrompt('cambridge_ket_writing_part6_a2_evaluation', {
      SCENARIO: input.scenario,
      CONTENT_POINTS: contentPointsFormatted,
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

  let parsed: z.infer<typeof EvaluationSchema> | null = null;
  for (let attempt = 0; attempt < 3 && !parsed; attempt++) {
    const result = await callGemini(
      { promptKey: 'cambridge_ket_writing_part6_a2_evaluation', model: MODELS.FLASH_LITE, userId: input.userId },
      (ai) =>
        ai.models.generateContent({
          model: MODELS.FLASH_LITE,
          contents: [{ role: 'user', parts: [{ text: evalPromptText }] }],
          config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
        })
    );
    if (!isOk(result)) continue;
    const rawText = result.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    parsed = safeParse(EvaluationSchema, rawText);
  }

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

  const feedback: KETShortMessageFeedback = {
    understood: parsed.understood,
    highlights: parsed.highlights.map((h) => stripDashes(h)),
    suggestions: parsed.suggestions.map((s) => stripDashes(s)),
    modelAnswer: parsed.model_answer ? stripDashes(parsed.model_answer) : null,
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
