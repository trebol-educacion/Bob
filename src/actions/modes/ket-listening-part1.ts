'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { stripDashes } from '@/lib/text';
import { callGemini, isOk } from '@/lib/gemini-client';
import { persistMessage, persistMessages } from '@/lib/persist-activity';
import { createSessionAction } from '@/actions/sessions';
import { createSupabaseServer } from '@/lib/supabase/server';
import { generateSpeechAction } from '@/actions/gemini';
import { generateYLImagesParallelAction } from '@/actions/modes/yl';
import { MODELS } from '@/lib/models';

const DialogueTurnSchema = z.object({
  speaker: z.enum(['M', 'W']),
  line: z.string(),
});

const ListenOptionSchema = z.object({
  id: z.enum(['A', 'B', 'C']),
  description: z.string(),
  image_prompt: z.string(),
});

const ListenItemSchema = z.object({
  number: z.number().int().min(1).max(5),
  context: z.string(),
  dialogue: z.array(DialogueTurnSchema).min(2).max(4),
  question: z.string(),
  options: z.array(ListenOptionSchema).length(3),
  correct_option: z.enum(['A', 'B', 'C']),
});

const GenerationSchema = z.object({
  items: z.array(ListenItemSchema).length(5),
});

export type ListenDialogueTurn = z.infer<typeof DialogueTurnSchema>;
export type ListenOption = z.infer<typeof ListenOptionSchema>;

/** A single Listen and Choose item with resolved image URLs and audio. */
export interface ListenItem {
  number: number;
  context: string;
  dialogue: ListenDialogueTurn[];
  question: string;
  options: Array<ListenOption & { image_url: string }>;
  correct_option: 'A' | 'B' | 'C';
  /** Base64 TTS audio of the full dialogue. */
  audio_b64: string;
  audio_mime: string;
}

/** Full result returned from generateKETListenAndChooseAction. */
export interface KETListeningResult {
  sessionId: string;
  userId: string;
  framingText: string;
  items: ListenItem[];
}

/** Per-item result after submit. */
export interface ListenAnswerResult {
  number: number;
  chosen: 'A' | 'B' | 'C';
  correct_option: 'A' | 'B' | 'C';
  isCorrect: boolean;
  dialogue: ListenDialogueTurn[];
}

/** Full submit result. */
export interface KETListenSubmitResult {
  correctCount: number;
  total: number;
  results: ListenAnswerResult[];
}

function buildDialogueText(dialogue: ListenDialogueTurn[]): string {
  return dialogue
    .map((turn) => `${turn.speaker === 'M' ? 'Man' : 'Woman'}: ${turn.line}`)
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
 * Generates 5 KET A2 Listen and Choose items.
 * Pre-generates all TTS audio and scene images in parallel before returning.
 * Creates a session when none is provided.
 */
export async function generateKETListenAndChooseAction(input: {
  sessionId?: string;
}): Promise<KETListeningResult | { error: string }> {
  let sessionId = input.sessionId;
  let userId: string | undefined;

  if (!sessionId) {
    const result = await createSessionAction({
      mode: 'cambridge_ket_listening_part1',
      title: 'Listening Part 1: Listen and Choose',
    });
    if (!result.data) {
      return { error: result.error ?? 'Could not create session' };
    }
    sessionId = result.data.id;
    userId = result.data.user_id;
  } else {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };
    userId = user.id;
  }

  const [generationPrompt, framingText] = await Promise.all([
    getPrompt('cambridge_ket_listening_part1_a2_generation').catch(() => null),
    getPrompt('cambridge_ket_listening_part1_a2_framing').catch(
      () =>
        'You will hear 5 short conversations. After each one, choose the picture that matches what you heard, A, B or C.'
    ),
  ]);

  if (!generationPrompt) {
    return { error: 'Could not load generation prompt' };
  }

  const cleanFramingText = stripDashes(framingText);

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_ket_listening_part1_a2_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: generationPrompt }] }],
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      })
  );

  if (!isOk(geminiResult)) {
    return { error: 'Could not generate items' };
  }

  const rawText = geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(GenerationSchema, rawText);

  if (!parsed) {
    return { error: 'Unexpected model response' };
  }

  const allImagePrompts = parsed.items.flatMap((item) => item.options.map((opt) => opt.image_prompt));
  const audioPromises = parsed.items.map((item) =>
    generateSpeechAction(buildDialogueText(item.dialogue)).catch(() => ({
      data: '',
      mimeType: 'audio/L16;codec=pcm;rate=24000',
    }))
  );

  const [allImageUrls, audios] = await Promise.all([
    generateYLImagesParallelAction('starters', 1, allImagePrompts, sessionId!, undefined, 'scene').catch(
      () => allImagePrompts.map(() => '')
    ),
    Promise.all(audioPromises),
  ]);

  const resolvedItems: ListenItem[] = parsed.items.map((item, itemIdx) => {
    const sliceStart = itemIdx * 3;
    const imageUrls = allImageUrls.slice(sliceStart, sliceStart + 3);
    const optionsWithImages = item.options.map((opt, optIdx) => ({
      ...opt,
      description: stripDashes(opt.description),
      image_url: imageUrls[optIdx] ?? '',
    }));
    const audio = audios[itemIdx] ?? { data: '', mimeType: 'audio/L16;codec=pcm;rate=24000' };
    return {
      number: item.number,
      context: stripDashes(item.context),
      dialogue: item.dialogue,
      question: stripDashes(item.question),
      options: optionsWithImages,
      correct_option: item.correct_option,
      audio_b64: audio.data,
      audio_mime: audio.mimeType,
    } satisfies ListenItem;
  });

  const planWithoutAudio = {
    kind: 'listening_plan',
    framing_text: cleanFramingText,
    items: resolvedItems.map((item) => ({
      number: item.number,
      context: item.context,
      dialogue: item.dialogue,
      question: item.question,
      options: item.options,
      correct_option: item.correct_option,
    })),
  };

  persistMessage({
    sessionId: sessionId!,
    userId: userId!,
    role: 'bob',
    msgType: 'text',
    contentText: null,
    contentJson: planWithoutAudio,
  }).catch(() => undefined);

  return {
    sessionId: sessionId!,
    userId: userId!,
    framingText: cleanFramingText,
    items: resolvedItems,
  };
}

/**
 * Evaluates answers deterministically and persists results.
 * No LLM involved — correct_option is embedded in each item.
 */
export async function submitKETListenAnswersAction(input: {
  sessionId: string;
  userId: string;
  answers: Record<number, 'A' | 'B' | 'C'>;
  items: ListenItem[];
}): Promise<KETListenSubmitResult | { error: string }> {
  const results: ListenAnswerResult[] = input.items.map((item) => {
    const chosen = input.answers[item.number] ?? 'A';
    return {
      number: item.number,
      chosen,
      correct_option: item.correct_option,
      isCorrect: chosen === item.correct_option,
      dialogue: item.dialogue,
    };
  });

  const correctCount = results.filter((r) => r.isCorrect).length;
  const total = input.items.length;

  const answerMessages = results.map((r) => ({
    sessionId: input.sessionId,
    userId: input.userId,
    role: 'user' as const,
    msgType: 'text' as const,
    contentText: null,
    contentJson: {
      kind: 'listening_answer',
      item_number: r.number,
      chosen: r.chosen,
      isCorrect: r.isCorrect,
    },
  }));

  persistMessages(answerMessages).catch(() => undefined);

  persistMessage({
    sessionId: input.sessionId,
    userId: input.userId,
    role: 'bob',
    msgType: 'evaluation',
    contentText: null,
    contentJson: {
      kind: 'listening_evaluation',
      score: correctCount,
      score_max: total,
      results,
      is_final: true,
    },
  }).catch(() => undefined);

  return { correctCount, total, results };
}
