'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';
import { MODELS } from '@/lib/models';
import { stripDashes } from '@/lib/text';

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
  sessionId: string;
  correct_count: number;
  total: number;
  item_results: LongTextItemResult[];
}

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try { return schema.parse(JSON.parse(raw)); } catch { return null; }
}

export async function generateKETLongTextAction(): Promise<LongTextResult | { error: string }> {
  const userId = (await currentUserId()) ?? undefined;
  if (!userId) return { error: 'Not authenticated' };

  const [generationPrompt, framingText] = await Promise.all([
    getPrompt('cambridge_ket_reading_part3_a2_generation').catch(() => null),
    getPrompt('cambridge_ket_reading_part3_a2_framing').catch(() => 'Read the article carefully. Then choose the best answer, A, B or C, for each question.'),
  ]);

  if (!generationPrompt) return { error: 'Could not load generation prompt' };

  let parsed: z.infer<typeof GenerationSchema> | null = null;
  for (let attempt = 0; attempt < 3 && !parsed; attempt++) {
    const geminiResult = await callGemini(
      { promptKey: 'cambridge_ket_reading_part3_a2_generation', model: MODELS.FLASH_LITE, userId },
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

  const exercise: LongTextExercise = {
    title: stripDashes(parsed.title),
    text: stripDashes(parsed.text),
    items: parsed.items.map((item) => ({
      number: item.number,
      question: stripDashes(item.question),
      options: { A: stripDashes(item.options.A), B: stripDashes(item.options.B), C: stripDashes(item.options.C) },
      answer: item.answer,
    })),
  };

  const cleanFraming = stripDashes(framingText);

  return { framing_text: cleanFraming, exercise };
}

export async function submitKETLongTextAction(input: {
  sessionId?: string;
  framing_text: string;
  exercise: LongTextExercise;
  answers: Record<number, 'A' | 'B' | 'C' | null>;
}): Promise<LongTextSubmitResult | { error: string }> {
  const item_results: LongTextItemResult[] = input.exercise.items.map((item) => {
    const chosen = input.answers[item.number] ?? null;
    return { number: item.number, chosen, correct_answer: item.answer, is_correct: chosen === item.answer };
  });

  const correct_count = item_results.filter((r) => r.is_correct).length;

  const completed = await completeActivity({
    mode: 'cambridge_ket_reading_part3',
    sessionId: input.sessionId,
    plan: { kind: 'reading_long_plan', framing_text: input.framing_text, exercise: input.exercise },
    answers: item_results.map((r) => ({ kind: 'reading_long_answer', item_number: r.number, chosen: r.chosen, is_correct: r.is_correct })),
    evaluation: { kind: 'reading_long_evaluation', score: correct_count, score_max: input.exercise.items.length, item_results, is_final: true },
  });
  if (!completed.ok) return { error: completed.code };

  return { sessionId: completed.data.sessionId, correct_count, total: input.exercise.items.length, item_results };
}
