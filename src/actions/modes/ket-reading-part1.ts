'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { stripDashes } from '@/lib/text';
import { callGemini, isOk } from '@/lib/gemini-client';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';
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
  sessionId: string;
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

/** Generates 6 KET A2 signs/notices items and a framing text; persists nothing until the first submit. */
export async function generateKETSignsAndNoticesAction(): Promise<KETSignsAndNoticesResult | { error: string }> {
  const userId = (await currentUserId()) ?? undefined;
  if (!userId) return { error: 'Not authenticated' };

  const [generationPrompt, framingText] = await Promise.all([
    getPrompt('cambridge_ket_reading_part1_a2_generation').catch(() => null),
    getPrompt('cambridge_ket_reading_part1_a2_framing').catch(
      () => 'You will read 6 signs and notices. For each one, choose the meaning that fits best, A, B or C.'
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

  return {
    items,
    framingText: cleanFraming,
  };
}

/** Evaluates student answers deterministically (no LLM) and persists results. */
export async function submitKETSignsAnswersAction(input: {
  sessionId?: string;
  framingText: string;
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

  const completed = await completeActivity({
    mode: 'cambridge_ket_reading_part1',
    sessionId: input.sessionId,
    plan: { kind: 'reading_prompt', items: input.items, framing_text: input.framingText },
    answers: results.map((r) => ({ kind: 'reading_answer', item_number: r.number, chosen: r.chosen, isCorrect: r.isCorrect })),
    evaluation: { kind: 'reading_evaluation', score: correctCount, score_max: total, results },
  });
  if (!completed.ok) return { error: completed.code };

  return { sessionId: completed.data.sessionId, correctCount, total, results };
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
