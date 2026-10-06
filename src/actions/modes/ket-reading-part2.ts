'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';
import { MODELS } from '@/lib/models';
import { stripDashes } from '@/lib/text';

const TextSchema = z.object({
  label: z.enum(['A', 'B', 'C']),
  author: z.string(),
  text: z.string(),
});

const QuestionSchema = z.object({
  number: z.number().int().min(1).max(6),
  text: z.string(),
  answer: z.enum(['A', 'B', 'C']),
});

const GenerationSchema = z.object({
  topic: z.string(),
  texts: z.array(TextSchema).length(3),
  questions: z.array(QuestionSchema).length(6),
});

export type ReadingText = z.infer<typeof TextSchema>;
export type MatchQuestion = z.infer<typeof QuestionSchema>;

export interface MatchExercise {
  topic: string;
  texts: ReadingText[];
  questions: MatchQuestion[];
}

export interface MatchResult {
  framing_text: string;
  exercise: MatchExercise;
}

export interface QuestionResult {
  number: number;
  chosen: 'A' | 'B' | 'C' | null;
  correct_answer: 'A' | 'B' | 'C';
  is_correct: boolean;
}

export interface MatchSubmitResult {
  sessionId: string;
  correct_count: number;
  total: number;
  question_results: QuestionResult[];
}

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try { return schema.parse(JSON.parse(raw)); } catch { return null; }
}

export async function generateKETMatchQuestionAction(): Promise<MatchResult | { error: string }> {
  const userId = (await currentUserId()) ?? undefined;
  if (!userId) return { error: 'Not authenticated' };

  const [generationPrompt, framingText] = await Promise.all([
    getPrompt('cambridge_ket_reading_part2_a2_generation').catch(() => null),
    getPrompt('cambridge_ket_reading_part2_a2_framing').catch(() => 'Read the three texts. Then match each question to the correct person, A, B or C.'),
  ]);

  if (!generationPrompt) return { error: 'Could not load generation prompt' };

  let parsed: z.infer<typeof GenerationSchema> | null = null;
  for (let attempt = 0; attempt < 3 && !parsed; attempt += 1) {
    const geminiResult = await callGemini(
      { promptKey: 'cambridge_ket_reading_part2_a2_generation', model: MODELS.FLASH_LITE, userId },
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

  if (!parsed) return { error: 'Unexpected model response' };

  const exercise: MatchExercise = {
    topic: parsed.topic,
    texts: parsed.texts.map((t) => ({ ...t, author: stripDashes(t.author), text: stripDashes(t.text) })),
    questions: parsed.questions.map((q) => ({ ...q, text: stripDashes(q.text) })),
  };

  const cleanFramingText = stripDashes(framingText);

  return { framing_text: cleanFramingText, exercise };
}

export async function submitKETMatchQuestionAction(input: {
  sessionId?: string;
  framing_text: string;
  exercise: MatchExercise;
  answers: Record<number, 'A' | 'B' | 'C' | null>;
}): Promise<MatchSubmitResult | { error: string }> {
  const question_results: QuestionResult[] = input.exercise.questions.map((q) => {
    const chosen = input.answers[q.number] ?? null;
    return { number: q.number, chosen, correct_answer: q.answer, is_correct: chosen === q.answer };
  });

  const correct_count = question_results.filter((r) => r.is_correct).length;

  const completed = await completeActivity({
    mode: 'cambridge_ket_reading_part2',
    sessionId: input.sessionId,
    plan: { kind: 'reading_match_plan', framing_text: input.framing_text, exercise: input.exercise },
    answers: question_results.map((r) => ({ kind: 'reading_match_answer', question_number: r.number, chosen: r.chosen, is_correct: r.is_correct })),
    evaluation: { kind: 'reading_match_evaluation', score: correct_count, score_max: input.exercise.questions.length, question_results, is_final: true },
  });
  if (!completed.ok) return { error: completed.code };

  return { sessionId: completed.data.sessionId, correct_count, total: input.exercise.questions.length, question_results };
}
