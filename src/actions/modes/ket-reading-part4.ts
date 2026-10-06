'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';
import { MODELS } from '@/lib/models';
import { stripDashes } from '@/lib/text';

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
  sessionId: string;
  correct_count: number;
  total: number;
  item_results: VocabGapItemResult[];
}

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try { return schema.parse(JSON.parse(raw)); } catch { return null; }
}

export async function generateKETVocabGapAction(): Promise<VocabGapResult | { error: string }> {
  const userId = (await currentUserId()) ?? undefined;
  if (!userId) return { error: 'Not authenticated' };

  const [generationPrompt, rawFramingText] = await Promise.all([
    getPrompt('cambridge_ket_reading_part4_a2_generation').catch(() => null),
    getPrompt('cambridge_ket_reading_part4_a2_framing').catch(() => 'Read the text and choose the best word, A, B or C, for each gap.'),
  ]);

  if (!generationPrompt) return { error: 'Could not load generation prompt' };

  const framingText = stripDashes(rawFramingText);

  let parsed: z.infer<typeof GenerationSchema> | null = null;
  for (let attempt = 0; attempt < 3 && !parsed; attempt++) {
    const geminiResult = await callGemini(
      { promptKey: 'cambridge_ket_reading_part4_a2_generation', model: MODELS.FLASH_LITE, userId },
      (ai) => ai.models.generateContent({
        model: MODELS.FLASH_LITE,
        contents: [{ role: 'user', parts: [{ text: generationPrompt }] }],
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      })
    );
    if (!isOk(geminiResult)) continue;
    const rawText = geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    parsed = safeParse(GenerationSchema, rawText);
  }

  if (!parsed) return { error: 'Could not generate exercise' };

  const exercise: VocabGapExercise = {
    title: stripDashes(parsed.title),
    text: parsed.text,
    items: parsed.items.map((it) => ({
      ...it,
      options: { A: stripDashes(it.options.A), B: stripDashes(it.options.B), C: stripDashes(it.options.C) },
    })),
  };

  return { framing_text: framingText, exercise };
}

export async function submitKETVocabGapAction(input: {
  sessionId?: string;
  framing_text: string;
  exercise: VocabGapExercise;
  answers: Record<number, 'A' | 'B' | 'C' | null>;
}): Promise<VocabGapSubmitResult | { error: string }> {
  const item_results: VocabGapItemResult[] = input.exercise.items.map((item) => {
    const chosen = input.answers[item.number] ?? null;
    return { number: item.number, chosen, correct_answer: item.answer, is_correct: chosen === item.answer };
  });

  const correct_count = item_results.filter((r) => r.is_correct).length;

  const completed = await completeActivity({
    mode: 'cambridge_ket_reading_part4',
    sessionId: input.sessionId,
    plan: { kind: 'reading_vocab_gap_plan', framing_text: input.framing_text, exercise: input.exercise },
    answers: item_results.map((r) => ({ kind: 'reading_vocab_gap_answer', item_number: r.number, chosen: r.chosen, is_correct: r.is_correct })),
    evaluation: { kind: 'reading_vocab_gap_evaluation', score: correct_count, score_max: input.exercise.items.length, item_results, is_final: true },
  });
  if (!completed.ok) return { error: completed.code };

  return { sessionId: completed.data.sessionId, correct_count, total: input.exercise.items.length, item_results };
}
