'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { persistMessage } from '@/lib/persist-activity';
import { createSessionAction } from '@/actions/sessions';
import { MODELS } from '@/lib/models';

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
}

const GenerationSchema = z.object({
  scenario: z.string(),
  recipient: z.string(),
  content_points: z.array(z.string()).min(2).max(3),
  word_target: z.number().default(25),
});

const EvaluationSchema = z.object({
  understood: z.boolean(),
  highlights: z.array(z.string()),
  suggestions: z.array(z.string()),
  model_answer: z.string().nullable().optional(),
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
      title: 'KET Writing Part 6 — Short Message',
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

  const result = await callGemini(
    { promptKey: 'cambridge_ket_writing_part6_a2_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: generationPrompt }] }],
        config: { responseMimeType: 'application/json' },
      })
  );

  if (!isOk(result)) {
    return { error: 'No se pudo generar la consigna' };
  }

  const rawText = result.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(GenerationSchema, rawText);

  if (!parsed) {
    return { error: 'Respuesta inesperada del modelo' };
  }

  persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'text',
    contentText: null,
    contentJson: {
      kind: 'writing_prompt',
      scenario: parsed.scenario,
      recipient: parsed.recipient,
      content_points: parsed.content_points,
      word_target: parsed.word_target,
      framing_text: framingText,
    },
  }).catch(() => undefined);

  return {
    sessionId,
    userId,
    scenario: parsed.scenario,
    recipient: parsed.recipient,
    contentPoints: parsed.content_points,
    wordTarget: parsed.word_target,
    framingText,
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

  const result = await callGemini(
    { promptKey: 'cambridge_ket_writing_part6_a2_evaluation', model: MODELS.FLASH_LITE_PREVIEW, userId: input.userId },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: evalPromptText }] }],
        config: { responseMimeType: 'application/json' },
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

  const feedback: KETShortMessageFeedback = {
    understood: parsed.understood,
    highlights: parsed.highlights,
    suggestions: parsed.suggestions,
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
