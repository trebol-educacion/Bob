'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { stripDashes } from '@/lib/text';
import { callGemini, isOk } from '@/lib/gemini-client';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';
import { MODELS } from '@/lib/models';

export type Verdict = 'T' | 'F' | 'DS';

const StatementSchema = z.object({
  number: z.number().int().min(1).max(6),
  text: z.string(),
  verdict: z.enum(['T', 'F', 'DS']),
});

const GenerationSchema = z.object({
  title: z.string(),
  text: z.string(),
  statements: z.array(StatementSchema).length(6),
});

export type ReadingStatement = z.infer<typeof StatementSchema>;

export interface ReadingTFDSExercise {
  title: string;
  text: string;
  statements: ReadingStatement[];
}

export interface ReadingTFDSResult {
  framing_text: string;
  exercise: ReadingTFDSExercise;
}

export interface ReadingStatementResult {
  number: number;
  text: string;
  chosen: Verdict | null;
  correct_verdict: Verdict;
  is_correct: boolean;
}

export interface ReadingTFDSSubmitResult {
  sessionId: string;
  correct_count: number;
  total: number;
  statement_results: ReadingStatementResult[];
}

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try { return schema.parse(JSON.parse(raw)); } catch { return null; }
}

export async function generateKETReadingTFDSAction(): Promise<ReadingTFDSResult | { error: string }> {
  const userId = (await currentUserId()) ?? undefined;
  if (!userId) return { error: 'Not authenticated' };

  const [generationPrompt, framingText] = await Promise.all([
    getPrompt('cambridge_ket_reading_part5_a2_generation').catch(() => null),
    getPrompt('cambridge_ket_reading_part5_a2_framing').catch(() => 'Read the text carefully. Then decide if each statement is True, False, or Doesn\'t Say, T, F or DS.'),
  ]);

  if (!generationPrompt) return { error: 'Could not load generation prompt' };

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_ket_reading_part5_a2_generation', model: MODELS.FLASH_LITE, userId },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE,
      contents: [{ role: 'user', parts: [{ text: generationPrompt }] }],
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    })
  );

  if (!isOk(geminiResult)) return { error: 'Could not generate exercise' };

  const rawText = geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(GenerationSchema, rawText);
  if (!parsed) return { error: 'Unexpected model response' };

  const exercise: ReadingTFDSExercise = {
    title: stripDashes(parsed.title),
    text: stripDashes(parsed.text),
    statements: parsed.statements.map((s) => ({ ...s, text: stripDashes(s.text) })),
  };

  const cleanFramingText = stripDashes(framingText);

  return { framing_text: cleanFramingText, exercise };
}

export async function submitKETReadingTFDSAction(input: {
  sessionId?: string;
  framing_text: string;
  exercise: ReadingTFDSExercise;
  answers: Record<number, Verdict | null>;
}): Promise<ReadingTFDSSubmitResult | { error: string }> {
  const statement_results: ReadingStatementResult[] = input.exercise.statements.map((s) => {
    const chosen = input.answers[s.number] ?? null;
    return { number: s.number, text: s.text, chosen, correct_verdict: s.verdict, is_correct: chosen === s.verdict };
  });

  const correct_count = statement_results.filter((r) => r.is_correct).length;

  const completed = await completeActivity({
    mode: 'cambridge_ket_reading_part5',
    sessionId: input.sessionId,
    plan: { kind: 'reading_tfds_plan', framing_text: input.framing_text, exercise: input.exercise },
    answers: statement_results.map((r) => ({ kind: 'reading_tfds_answer', statement_number: r.number, chosen: r.chosen, is_correct: r.is_correct })),
    evaluation: { kind: 'reading_tfds_evaluation', score: correct_count, score_max: input.exercise.statements.length, statement_results, is_final: true },
  });
  if (!completed.ok) return { error: completed.code };

  return { sessionId: completed.data.sessionId, correct_count, total: input.exercise.statements.length, statement_results };
}
