'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { persistMessage, persistMessages } from '@/lib/persist-activity';
import { createSessionAction } from '@/actions/sessions';
import { createSupabaseServer } from '@/lib/supabase/server';
import { MODELS } from '@/lib/models';

const ItemSchema = z.object({
  number: z.number().int().min(1).max(6),
  question: z.string(),
  options: z.object({ A: z.string(), B: z.string(), C: z.string() }),
  answer: z.enum(['A', 'B', 'C']),
});

const GenerationSchema = z.object({
  title: z.string(),
  text: z.string(),
  items: z.array(ItemSchema).length(6),
});

export type LongTextItem = z.infer<typeof ItemSchema>;

export interface LongTextExercise {
  title: string;
  text: string;
  items: LongTextItem[];
}

export interface LongTextResult {
  sessionId: string;
  userId: string;
  framing_text: string;
  exercise: LongTextExercise;
}

export interface LongTextItemResult {
  number: number;
  chosen: 'A' | 'B' | 'C' | null;
  correct_answer: 'A' | 'B' | 'C';
  is_correct: boolean;
}

export interface LongTextSubmitResult {
  correct_count: number;
  total: number;
  item_results: LongTextItemResult[];
}

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try { return schema.parse(JSON.parse(raw)); } catch { return null; }
}

export async function generateKETLongTextAction(input: {
  sessionId?: string;
}): Promise<LongTextResult | { error: string }> {
  let sessionId = input.sessionId;
  let userId: string | undefined;

  if (!sessionId) {
    const result = await createSessionAction({ mode: 'cambridge_ket_reading_part3', title: 'Reading Part 3 — Read and Decide' });
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
    getPrompt('cambridge_ket_reading_part3_a2_generation').catch(() => null),
    getPrompt('cambridge_ket_reading_part3_a2_framing').catch(() => 'Read the article carefully. Then choose the best answer — A, B or C — for each question.'),
  ]);

  if (!generationPrompt) return { error: 'Could not load generation prompt' };

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_ket_reading_part3_a2_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: generationPrompt }] }],
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    })
  );

  if (!isOk(geminiResult)) return { error: 'Could not generate exercise' };

  const rawText = geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(GenerationSchema, rawText);
  if (!parsed) return { error: 'Unexpected model response' };

  const exercise: LongTextExercise = { title: parsed.title, text: parsed.text, items: parsed.items };

  persistMessage({
    sessionId: sessionId!, userId: userId!, role: 'bob', msgType: 'text',
    contentText: null,
    contentJson: { kind: 'reading_long_plan', framing_text: framingText, exercise },
  }).catch(() => undefined);

  return { sessionId: sessionId!, userId: userId!, framing_text: framingText, exercise };
}

export async function submitKETLongTextAction(input: {
  sessionId: string;
  userId: string;
  answers: Record<number, 'A' | 'B' | 'C' | null>;
  items: LongTextItem[];
}): Promise<LongTextSubmitResult | { error: string }> {
  const item_results: LongTextItemResult[] = input.items.map((item) => {
    const chosen = input.answers[item.number] ?? null;
    return { number: item.number, chosen, correct_answer: item.answer, is_correct: chosen === item.answer };
  });

  const correct_count = item_results.filter((r) => r.is_correct).length;

  persistMessages(item_results.map((r) => ({
    sessionId: input.sessionId, userId: input.userId, role: 'user' as const, msgType: 'text' as const,
    contentText: null,
    contentJson: { kind: 'reading_long_answer', item_number: r.number, chosen: r.chosen, is_correct: r.is_correct },
  }))).catch(() => undefined);

  persistMessage({
    sessionId: input.sessionId, userId: input.userId, role: 'bob', msgType: 'evaluation',
    contentText: null,
    contentJson: { kind: 'reading_long_evaluation', score: correct_count, score_max: input.items.length, item_results, is_final: true },
  }).catch(() => undefined);

  return { correct_count, total: input.items.length, item_results };
}
