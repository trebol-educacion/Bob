'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { persistMessage, persistMessages } from '@/lib/persist-activity';
import { createSessionAction } from '@/actions/sessions';
import { createSupabaseServer } from '@/lib/supabase/server';
import { MODELS } from '@/lib/models';

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
  sessionId: string;
  userId: string;
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
  correct_count: number;
  total: number;
  question_results: QuestionResult[];
}

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try { return schema.parse(JSON.parse(raw)); } catch { return null; }
}

export async function generateKETMatchQuestionAction(input: {
  sessionId?: string;
}): Promise<MatchResult | { error: string }> {
  let sessionId = input.sessionId;
  let userId: string | undefined;

  if (!sessionId) {
    const result = await createSessionAction({ mode: 'cambridge_ket_reading_part2', title: 'Reading Part 2 — Match the Question' });
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
    getPrompt('cambridge_ket_reading_part2_a2_generation').catch(() => null),
    getPrompt('cambridge_ket_reading_part2_a2_framing').catch(() => 'Read the three texts. Then match each question to the correct person — A, B or C.'),
  ]);

  if (!generationPrompt) return { error: 'Could not load generation prompt' };

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_ket_reading_part2_a2_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
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

  const exercise: MatchExercise = { topic: parsed.topic, texts: parsed.texts, questions: parsed.questions };

  persistMessage({
    sessionId: sessionId!, userId: userId!, role: 'bob', msgType: 'text',
    contentText: null,
    contentJson: { kind: 'reading_match_plan', framing_text: framingText, exercise },
  }).catch(() => undefined);

  return { sessionId: sessionId!, userId: userId!, framing_text: framingText, exercise };
}

export async function submitKETMatchQuestionAction(input: {
  sessionId: string;
  userId: string;
  answers: Record<number, 'A' | 'B' | 'C' | null>;
  questions: MatchQuestion[];
}): Promise<MatchSubmitResult | { error: string }> {
  const question_results: QuestionResult[] = input.questions.map((q) => {
    const chosen = input.answers[q.number] ?? null;
    return { number: q.number, chosen, correct_answer: q.answer, is_correct: chosen === q.answer };
  });

  const correct_count = question_results.filter((r) => r.is_correct).length;

  persistMessages(question_results.map((r) => ({
    sessionId: input.sessionId, userId: input.userId, role: 'user' as const, msgType: 'text' as const,
    contentText: null,
    contentJson: { kind: 'reading_match_answer', question_number: r.number, chosen: r.chosen, is_correct: r.is_correct },
  }))).catch(() => undefined);

  persistMessage({
    sessionId: input.sessionId, userId: input.userId, role: 'bob', msgType: 'evaluation',
    contentText: null,
    contentJson: { kind: 'reading_match_evaluation', score: correct_count, score_max: input.questions.length, question_results, is_final: true },
  }).catch(() => undefined);

  return { correct_count, total: input.questions.length, question_results };
}
