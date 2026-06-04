'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { persistMessage, persistMessages } from '@/lib/persist-activity';
import { createSessionAction } from '@/actions/sessions';
import { createSupabaseServer } from '@/lib/supabase/server';
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
  sessionId: string;
  userId: string;
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

export async function generateKETListenDecideAction(input: {
  sessionId?: string;
}): Promise<ListenDecideResult | { error: string }> {
  let sessionId = input.sessionId;
  let userId: string | undefined;

  if (!sessionId) {
    const result = await createSessionAction({
      mode: 'cambridge_ket_listening_part3',
      title: 'KET Listening Part 3 — Listen and Decide',
    });
    if (!result.data) return { error: result.error ?? 'Could not create session' };
    sessionId = result.data.id;
    userId = result.data.user_id;
  } else {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };
    userId = user.id;
  }

  const [generationPrompt, framingText] = await Promise.all([
    getPrompt('cambridge_ket_listening_part3_a2_generation').catch(() => null),
    getPrompt('cambridge_ket_listening_part3_a2_framing').catch(
      () => 'You will hear a conversation between two people. Listen carefully and choose the best answer — A, B or C — for each question.'
    ),
  ]);

  if (!generationPrompt) return { error: 'Could not load generation prompt' };

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_ket_listening_part3_a2_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: generationPrompt }] }],
        config: { responseMimeType: 'application/json' },
      })
  );

  if (!isOk(geminiResult)) return { error: 'Could not generate exercise' };

  const rawText = geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(GenerationSchema, rawText);
  if (!parsed) return { error: 'Unexpected model response' };

  const audioResult = await generateSpeechAction(buildConversationText(parsed.conversation)).catch(
    () => ({ data: '', mimeType: 'audio/L16;codec=pcm;rate=24000' })
  );

  const exercise: ListenDecideExercise = {
    context: parsed.context,
    conversation: parsed.conversation,
    items: parsed.items,
    audio_b64: audioResult.data,
    audio_mime: audioResult.mimeType,
  };

  persistMessage({
    sessionId: sessionId!,
    userId: userId!,
    role: 'bob',
    msgType: 'text',
    contentText: null,
    contentJson: {
      kind: 'listen_decide_plan',
      framing_text: framingText,
      exercise: {
        context: exercise.context,
        conversation: exercise.conversation,
        items: exercise.items,
      },
    },
  }).catch(() => undefined);

  return {
    sessionId: sessionId!,
    userId: userId!,
    framing_text: framingText,
    exercise,
  };
}

export async function submitKETListenDecideAction(input: {
  sessionId: string;
  userId: string;
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

  persistMessages(
    item_results.map((r) => ({
      sessionId: input.sessionId,
      userId: input.userId,
      role: 'user' as const,
      msgType: 'text' as const,
      contentText: null,
      contentJson: {
        kind: 'listen_decide_answer',
        item_number: r.number,
        chosen: r.chosen,
        is_correct: r.is_correct,
      },
    }))
  ).catch(() => undefined);

  persistMessage({
    sessionId: input.sessionId,
    userId: input.userId,
    role: 'bob',
    msgType: 'evaluation',
    contentText: null,
    contentJson: {
      kind: 'listen_decide_evaluation',
      score: correct_count,
      score_max: input.exercise.items.length,
      item_results,
      conversation: input.exercise.conversation,
      is_final: true,
    },
  }).catch(() => undefined);

  return {
    correct_count,
    total: input.exercise.items.length,
    item_results,
    conversation: input.exercise.conversation,
  };
}
