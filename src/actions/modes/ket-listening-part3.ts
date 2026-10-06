'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { stripDashes } from '@/lib/text';
import { callGemini, isOk } from '@/lib/gemini-client';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';
import { withoutAudio } from '@/lib/ket/plan';
import { generateSpeechAction } from '@/actions/gemini';
import { MODELS } from '@/lib/models';

const ConversationTurnSchema = z.object({
  speaker: z.enum(['M', 'W']),
  line: z.string(),
});

const ItemSchema = z.object({
  number: z.number().int().min(1).max(5),
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
  conversation: z.array(ConversationTurnSchema).min(4),
  items: z.array(ItemSchema).length(5),
});

export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;
export type ListenDecideItem = z.infer<typeof ItemSchema>;

export interface ListenDecideExercise {
  context: string;
  conversation: ConversationTurn[];
  items: ListenDecideItem[];
  audio_b64: string;
  audio_mime: string;
}

export interface ListenDecideResult {
  framing_text: string;
  exercise: ListenDecideExercise;
}

export interface ItemResult {
  number: number;
  chosen: 'A' | 'B' | 'C';
  correct_answer: 'A' | 'B' | 'C';
  is_correct: boolean;
}

export interface ListenDecideSubmitResult {
  sessionId: string;
  correct_count: number;
  total: number;
  item_results: ItemResult[];
  conversation: ConversationTurn[];
}

function buildConversationText(turns: ConversationTurn[]): string {
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

export async function generateKETListenDecideAction(): Promise<ListenDecideResult | { error: string }> {
  const userId = (await currentUserId()) ?? undefined;
  if (!userId) return { error: 'Not authenticated' };

  const [generationPrompt, framingText] = await Promise.all([
    getPrompt('cambridge_ket_listening_part3_a2_generation').catch(() => null),
    getPrompt('cambridge_ket_listening_part3_a2_framing').catch(
      () => 'You will hear a conversation between two people. Listen carefully and choose the best answer, A, B or C, for each question.'
    ),
  ]);

  const cleanFramingText = stripDashes(framingText);

  if (!generationPrompt) return { error: 'Could not load generation prompt' };

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_ket_listening_part3_a2_generation', model: MODELS.FLASH_LITE, userId },
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

  const cleanItems: ListenDecideItem[] = parsed.items.map((item) => ({
    ...item,
    question: stripDashes(item.question),
    options: {
      A: stripDashes(item.options.A),
      B: stripDashes(item.options.B),
      C: stripDashes(item.options.C),
    },
  }));

  const exercise: ListenDecideExercise = {
    context: stripDashes(parsed.context),
    conversation: parsed.conversation,
    items: cleanItems,
    audio_b64: '',
    audio_mime: 'audio/L16;codec=pcm;rate=24000',
  };

  return {
    framing_text: cleanFramingText,
    exercise,
  };
}

/** Generates the TTS audio for a Listen and Decide conversation, off the critical path. */
export async function generateKETListenDecideAudioAction(input: {
  conversation: ConversationTurn[];
}): Promise<{ data: string; mimeType: string }> {
  return generateSpeechAction(buildConversationText(input.conversation));
}

export async function submitKETListenDecideAction(input: {
  sessionId?: string;
  framing_text: string;
  answers: Record<number, 'A' | 'B' | 'C'>;
  exercise: Omit<ListenDecideExercise, 'audio_b64' | 'audio_mime'>;
}): Promise<ListenDecideSubmitResult | { error: string }> {
  const item_results: ItemResult[] = input.exercise.items.map((item) => {
    const chosen = input.answers[item.number] ?? 'A';
    return {
      number: item.number,
      chosen,
      correct_answer: item.answer,
      is_correct: chosen === item.answer,
    };
  });

  const correct_count = item_results.filter((r) => r.is_correct).length;

  const completed = await completeActivity({
    mode: 'cambridge_ket_listening_part3',
    sessionId: input.sessionId,
    plan: { kind: 'listen_decide_plan', framing_text: input.framing_text, exercise: withoutAudio(input.exercise) },
    answers: item_results.map((r) => ({
        kind: 'listen_decide_answer',
        item_number: r.number,
        chosen: r.chosen,
        is_correct: r.is_correct,
      })),
    evaluation: {
      kind: 'listen_decide_evaluation',
      score: correct_count,
      score_max: input.exercise.items.length,
      item_results,
      conversation: input.exercise.conversation,
      is_final: true,
    },
  });
  if (!completed.ok) return { error: completed.code };

  return {
    sessionId: completed.data.sessionId,
    correct_count,
    total: input.exercise.items.length,
    item_results,
    conversation: input.exercise.conversation,
  };
}
