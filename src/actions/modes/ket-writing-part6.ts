'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';
import { MODELS } from '@/lib/models';
import { stripDashes } from '@/lib/text';

export interface KETShortMessagePrompt {
  scenario: string;
  recipient: string;
  contentPoints: string[];
  wordTarget: number;
  framingText: string;
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

/** Generates a KET Writing Part 6 scenario and framing text; persists nothing until the evaluation succeeds. */
export async function generateKETShortMessageAction(): Promise<KETShortMessagePrompt | { error: string }> {
  const userId = (await currentUserId()) ?? undefined;
  if (!userId) return { error: 'userId requerido' };

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
      { promptKey: 'cambridge_ket_writing_part6_a2_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
      (ai) =>
        ai.models.generateContent({
          model: MODELS.FLASH_LITE_PREVIEW,
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

  return {
    scenario: cleanScenario,
    recipient: cleanRecipient,
    contentPoints: cleanContentPoints,
    wordTarget: parsed.word_target,
    framingText: cleanFramingText,
  };
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
