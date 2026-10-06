'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { stripDashes } from '@/lib/text';
import { callGemini, isOk } from '@/lib/gemini-client';
import { completeActivity } from '@/lib/session/complete';
import { currentUserId } from '@/lib/session/lifecycle';
import { sealPlan, unsealPlan } from '@/lib/session/sealed-plan';
import { generateSpeechAction } from '@/actions/gemini';
import { MODELS } from '@/lib/models';

const ConversationTurnSchema = z.object({
  speaker: z.enum(['M', 'W']),
  line: z.string(),
});

const ItemSchema = z.object({
  number: z.number().int().min(1).max(6),
  conversation: z.array(ConversationTurnSchema).min(2).max(8),
  question: z.string(),
  options: z.object({
    A: z.string(),
    B: z.string(),
    C: z.string(),
  }),
  answer: z.enum(['A', 'B', 'C']),
});

const GenerationSchema = z.object({
  context: z.string(),
  items: z.array(ItemSchema).length(6),
});

export type PETConversationTurn = z.infer<typeof ConversationTurnSchema>;
export type PETSituationalItem = z.infer<typeof ItemSchema>;

/** A single PET Listening Part 1 item without the answer key, plus its TTS audio. */
export interface PETSituationalClientItem {
  number: number;
  conversation: PETConversationTurn[];
  question: string;
  options: { A: string; B: string; C: string };
  audio_b64: string;
  audio_mime: string;
}

/** Full result returned from generatePETListeningSituationalAction. */
export interface PETListeningSituationalResult {
  planToken: string;
  framingText: string;
  context: string;
  items: PETSituationalClientItem[];
}

/** Per-item deterministic result after submit. */
export interface PETSituationalItemResult {
  number: number;
  chosen: 'A' | 'B' | 'C';
  correct_answer: 'A' | 'B' | 'C';
  is_correct: boolean;
}

/** Full submit result. */
export interface PETListeningSituationalSubmitResult {
  sessionId: string;
  correct_count: number;
  total: number;
  item_results: PETSituationalItemResult[];
}

function buildConversationText(turns: PETConversationTurn[]): string {
  return turns
    .map((t) => `${t.speaker === 'M' ? 'Man' : 'Woman'}: ${t.line}`)
    .join('\n');
}

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Generates 6 PET B1 Listening Part 1 situational items.
 * Returns items WITHOUT the answer key and with empty audio; the answer key
 * stays server-side and the TTS audio is synthesized off the critical path.
 */
export async function generatePETListeningSituationalAction(): Promise<PETListeningSituationalResult | { error: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'unauthenticated' };

  const [generationPrompt, framingText] = await Promise.all([
    getPrompt('cambridge_pet_listening_part1_b1_generation').catch(() => null),
    getPrompt('cambridge_pet_listening_part1_b1_framing').catch(
      () =>
        'Vas a escuchar varias conversaciones cortas de la vida diaria entre dos personas. Después de cada una, elige la respuesta correcta, A, B o C.'
    ),
  ]);

  const cleanFramingText = stripDashes(framingText);

  if (!generationPrompt) return { error: 'Could not load generation prompt' };

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_pet_listening_part1_b1_generation', model: MODELS.FLASH_LITE, userId },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE,
        contents: [{ role: 'user', parts: [{ text: generationPrompt }] }],
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      })
  );

  if (!isOk(geminiResult)) return { error: 'Could not generate exercise' };

  const rawText = geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(GenerationSchema, rawText);
  if (!parsed) return { error: 'Unexpected model response' };

  const cleanItems = parsed.items.map((item) => ({
    number: item.number,
    conversation: item.conversation,
    question: stripDashes(item.question),
    options: {
      A: stripDashes(item.options.A),
      B: stripDashes(item.options.B),
      C: stripDashes(item.options.C),
    },
    answer: item.answer,
  }));

  const clientItems: PETSituationalClientItem[] = cleanItems.map((item) => ({
    number: item.number,
    conversation: item.conversation,
    question: item.question,
    options: item.options,
    audio_b64: '',
    audio_mime: 'audio/L16;codec=pcm;rate=24000',
  }));

  const plan = {
    kind: 'pet_listening_situational_plan',
    framing_text: cleanFramingText,
    context: stripDashes(parsed.context),
    items: cleanItems,
  };

  return {
    planToken: sealPlan(plan, userId),
    framingText: cleanFramingText,
    context: stripDashes(parsed.context),
    items: clientItems,
  };
}

/** Generates the TTS audio for one situational conversation, off the critical path. */
export async function generatePETListeningSituationalAudioAction(input: {
  conversation: PETConversationTurn[];
}): Promise<{ data: string; mimeType: string }> {
  return generateSpeechAction(buildConversationText(input.conversation));
}

/**
 * Evaluates answers deterministically against the server-side answer key and
 * creates the session on this first turn and closes it. No LLM involved.
 */
export async function submitPETListeningSituationalAction(input: {
  sessionId?: string;
  planToken: string;
  answers: Record<number, 'A' | 'B' | 'C'>;
}): Promise<PETListeningSituationalSubmitResult | { error: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'unauthenticated' };
  const plan = unsealPlan<{ items?: Array<{ number: number; answer: 'A' | 'B' | 'C' }> }>(input.planToken, userId);
  const planItems = plan?.items;
  if (!planItems || planItems.length === 0) return { error: 'Could not load exercise' };

  const item_results: PETSituationalItemResult[] = planItems.map((item) => {
    const chosen = input.answers[item.number] ?? 'A';
    return {
      number: item.number,
      chosen,
      correct_answer: item.answer,
      is_correct: chosen === item.answer,
    };
  });

  const correct_count = item_results.filter((r) => r.is_correct).length;
  const total = planItems.length;

  const completed = await completeActivity({
    mode: 'cambridge_pet_listening_part1',
    sessionId: input.sessionId,
    plan,
    answers: item_results.map((r) => ({
      kind: 'pet_listening_situational_answer',
      item_number: r.number,
      chosen: r.chosen,
      is_correct: r.is_correct,
    })),
    evaluation: {
      kind: 'pet_listening_situational_evaluation',
      score: correct_count,
      score_max: total,
      item_results,
    },
  });
  if (!completed.ok) return { error: completed.code };

  return { sessionId: completed.data.sessionId, correct_count, total, item_results };
}
