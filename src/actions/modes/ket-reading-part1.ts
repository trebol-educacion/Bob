'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { stripDashes } from '@/lib/text';
import { callGemini, isOk } from '@/lib/gemini-client';
import { persistMessage, persistMessages } from '@/lib/persist-activity';
import { createSessionAction } from '@/actions/sessions';
import { createSupabaseServer } from '@/lib/supabase/server';
import { generateYLImagesParallelAction } from '@/actions/modes/yl';
import { MODELS } from '@/lib/models';

const OptionSchema = z.object({
  id: z.enum(['A', 'B', 'C']),
  text: z.string(),
});

const SignItemSchema = z.object({
  number: z.number().int().min(1).max(6),
  sign_text: z.string(),
  sign_context: z.string(),
  question: z.string(),
  options: z.array(OptionSchema).length(3),
  correct_option: z.enum(['A', 'B', 'C']),
  explanation: z.string(),
  sign_style: z.enum(['prohibition', 'warning', 'info', 'shop', 'default']).optional(),
});

const GenerationSchema = z.object({
  items: z.array(SignItemSchema).min(6).max(6),
});

export type SignOption = z.infer<typeof OptionSchema>;

/** A single sign/notice item as returned to the client. */
export interface SignItem {
  number: number;
  sign_text: string;
  sign_context: string;
  question: string;
  options: SignOption[];
  correct_option: 'A' | 'B' | 'C';
  explanation: string;
  sign_style?: 'prohibition' | 'warning' | 'info' | 'shop' | 'default';
}

/** Full result of a successful generation call. */
export interface KETSignsAndNoticesResult {
  sessionId: string;
  userId: string;
  items: SignItem[];
  framingText: string;
}

/** Per-item answer result returned after submit. */
export interface SignAnswerResult {
  number: number;
  chosen: 'A' | 'B' | 'C';
  correct_option: 'A' | 'B' | 'C';
  isCorrect: boolean;
  explanation: string;
}

/** Full submit result. */
export interface KETSignsSubmitResult {
  correctCount: number;
  total: number;
  results: SignAnswerResult[];
}

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Generates 6 KET A2 signs/notices items and a framing text; creates a session when none is provided. */
export async function generateKETSignsAndNoticesAction(input: {
  sessionId?: string;
}): Promise<KETSignsAndNoticesResult | { error: string }> {
  let sessionId = input.sessionId;
  let userId: string | undefined;

  if (!sessionId) {
    const result = await createSessionAction({
      mode: 'cambridge_ket_reading_part1',
      title: 'Reading Part 1, Signs and Notices',
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
    getPrompt('cambridge_ket_reading_part1_a2_generation').catch(() => null),
    getPrompt('cambridge_ket_reading_part1_a2_framing').catch(
      () => 'You will read 6 signs and notices. For each one, choose the meaning that fits best — A, B or C.'
    ),
  ]);

  if (!generationPrompt) {
    return { error: 'Could not load generation prompt' };
  }

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_ket_reading_part1_a2_generation', model: MODELS.FLASH_LITE, userId },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE,
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

  const items: SignItem[] = parsed.items.map((item) => ({
    ...item,
    sign_text: stripDashes(item.sign_text),
    sign_context: stripDashes(item.sign_context),
    question: stripDashes(item.question),
    options: item.options.map((opt) => ({ ...opt, text: stripDashes(opt.text) })),
    explanation: stripDashes(item.explanation),
  }));
  const cleanFraming = stripDashes(framingText);

  persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'text',
    contentText: null,
    contentJson: {
      kind: 'reading_prompt',
      items,
      framing_text: cleanFraming,
    },
  }).catch(() => undefined);

  return {
    sessionId,
    userId,
    items,
    framingText: cleanFraming,
  };
}

/** Evaluates student answers deterministically (no LLM) and persists results. */
export async function submitKETSignsAnswersAction(input: {
  sessionId: string;
  userId: string;
  answers: Record<number, 'A' | 'B' | 'C'>;
  items: SignItem[];
}): Promise<KETSignsSubmitResult | { error: string }> {
  const results: SignAnswerResult[] = input.items.map((item) => {
    const chosen = input.answers[item.number] ?? 'A';
    return {
      number: item.number,
      chosen,
      correct_option: item.correct_option,
      isCorrect: chosen === item.correct_option,
      explanation: item.explanation,
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
      kind: 'reading_answer',
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
      kind: 'reading_evaluation',
      score: correctCount,
      score_max: total,
      results,
      is_final: true,
    },
  }).catch(() => undefined);

  return { correctCount, total, results };
}

/** One generated scene illustration mapped back to its sign number. */
export interface KETSignImage {
  number: number;
  image_url: string;
}

/** Generates one child-friendly scene illustration per sign, off the critical path (no text inside the image). */
export async function generateKETSignImagesAction(input: {
  items: { number: number; sign_context: string; sign_style: string }[];
  sessionId?: string;
}): Promise<KETSignImage[]> {
  if (input.items.length === 0) return [];

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const sessionId = input.sessionId ?? user?.id ?? 'ket-reading-part1';

  const prompts = input.items.map(
    (it) =>
      `A bright, friendly flat illustration of a ${it.sign_context} (a place a child might visit). Cheerful, simple, colorful, for kids. IMPORTANT: absolutely no text, no words, no letters, no signs with writing in the image.`
  );

  const imageUrls = await generateYLImagesParallelAction(
    'movers',
    1,
    prompts,
    sessionId,
    undefined,
    'scene'
  ).catch(() => input.items.map(() => ''));

  return input.items.map((it, idx) => ({
    number: it.number,
    image_url: imageUrls[idx] ?? '',
  }));
}
