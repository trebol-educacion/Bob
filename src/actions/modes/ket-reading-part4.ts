'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { persistMessage, persistMessages } from '@/lib/persist-activity';
import { createSessionAction } from '@/actions/sessions';
import { createSupabaseServer } from '@/lib/supabase/server';
import { MODELS } from '@/lib/models';

const GapItemSchema = z.object({
  number: z.number().int().min(1).max(6),
  options: z.object({ A: z.string(), B: z.string(), C: z.string() }),
  answer: z.enum(['A', 'B', 'C']),
});

const GenerationSchema = z.object({
  title: z.string(),
  text: z.string(),
  items: z.array(GapItemSchema).length(6),
});

export type VocabGapItem = z.infer<typeof GapItemSchema>;

export interface VocabGapExercise {
  title: string;
  text: string;
  items: VocabGapItem[];
}

export interface VocabGapResult {
  sessionId: string;
  userId: string;
  framing_text: string;
  exercise: VocabGapExercise;
}

export interface VocabGapItemResult {
  number: number;
  chosen: 'A' | 'B' | 'C' | null;
  correct_answer: 'A' | 'B' | 'C';
  is_correct: boolean;
}

export interface VocabGapSubmitResult {
  correct_count: number;
  total: number;
  item_results: VocabGapItemResult[];
}

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try { return schema.parse(JSON.parse(raw)); } catch { return null; }
}

export async function generateKETVocabGapAction(input: {
  sessionId?: string;
}): Promise<VocabGapResult | { error: string }> {
  let sessionId = input.sessionId;
  let userId: string | undefined;

  if (!sessionId) {
    const result = await createSessionAction({ mode: 'cambridge_ket_reading_part4', title: 'KET Reading Part 4 — Choose the Word' });
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
    getPrompt('cambridge_ket_reading_part4_a2_generation').catch(() => null),
    getPrompt('cambridge_ket_reading_part4_a2_framing').catch(() => 'Read the text and choose the best word — A, B or C — for each gap.'),
  ]);

  if (!generationPrompt) return { error: 'Could not load generation prompt' };

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_ket_reading_part4_a2_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
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

  const exercise: VocabGapExercise = { title: parsed.title, text: parsed.text, items: parsed.items };

  persistMessage({
    sessionId: sessionId!, userId: userId!, role: 'bob', msgType: 'text',
    contentText: null,
    contentJson: { kind: 'reading_vocab_gap_plan', framing_text: framingText, exercise },
  }).catch(() => undefined);

  return { sessionId: sessionId!, userId: userId!, framing_text: framingText, exercise };
}

export async function submitKETVocabGapAction(input: {
  sessionId: string;
  userId: string;
  answers: Record<number, 'A' | 'B' | 'C' | null>;
  items: VocabGapItem[];
}): Promise<VocabGapSubmitResult | { error: string }> {
  const item_results: VocabGapItemResult[] = input.items.map((item) => {
    const chosen = input.answers[item.number] ?? null;
    return { number: item.number, chosen, correct_answer: item.answer, is_correct: chosen === item.answer };
  });

  const correct_count = item_results.filter((r) => r.is_correct).length;

  persistMessages(item_results.map((r) => ({
    sessionId: input.sessionId, userId: input.userId, role: 'user' as const, msgType: 'text' as const,
    contentText: null,
    contentJson: { kind: 'reading_vocab_gap_answer', item_number: r.number, chosen: r.chosen, is_correct: r.is_correct },
  }))).catch(() => undefined);

  persistMessage({
    sessionId: input.sessionId, userId: input.userId, role: 'bob', msgType: 'evaluation',
    contentText: null,
    contentJson: { kind: 'reading_vocab_gap_evaluation', score: correct_count, score_max: input.items.length, item_results, is_final: true },
  }).catch(() => undefined);

  return { correct_count, total: input.items.length, item_results };
}
