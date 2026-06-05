'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { persistMessage, persistMessages } from '@/lib/persist-activity';
import { createSessionAction } from '@/actions/sessions';
import { createSupabaseServer } from '@/lib/supabase/server';
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
  sessionId: string;
  userId: string;
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
  correct_count: number;
  total: number;
  statement_results: ReadingStatementResult[];
}

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try { return schema.parse(JSON.parse(raw)); } catch { return null; }
}

export async function generateKETReadingTFDSAction(input: {
  sessionId?: string;
}): Promise<ReadingTFDSResult | { error: string }> {
  let sessionId = input.sessionId;
  let userId: string | undefined;

  if (!sessionId) {
    const result = await createSessionAction({ mode: 'cambridge_ket_reading_part5', title: 'Reading Part 5 — True, False or Doesn\'t Say' });
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
    getPrompt('cambridge_ket_reading_part5_a2_generation').catch(() => null),
    getPrompt('cambridge_ket_reading_part5_a2_framing').catch(() => 'Read the text carefully. Then decide if each statement is True, False, or Doesn\'t Say — T, F or DS.'),
  ]);

  if (!generationPrompt) return { error: 'Could not load generation prompt' };

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_ket_reading_part5_a2_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
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

  const exercise: ReadingTFDSExercise = { title: parsed.title, text: parsed.text, statements: parsed.statements };

  persistMessage({
    sessionId: sessionId!, userId: userId!, role: 'bob', msgType: 'text',
    contentText: null,
    contentJson: { kind: 'reading_tfds_plan', framing_text: framingText, exercise },
  }).catch(() => undefined);

  return { sessionId: sessionId!, userId: userId!, framing_text: framingText, exercise };
}

export async function submitKETReadingTFDSAction(input: {
  sessionId: string;
  userId: string;
  answers: Record<number, Verdict | null>;
  statements: ReadingStatement[];
}): Promise<ReadingTFDSSubmitResult | { error: string }> {
  const statement_results: ReadingStatementResult[] = input.statements.map((s) => {
    const chosen = input.answers[s.number] ?? null;
    return { number: s.number, text: s.text, chosen, correct_verdict: s.verdict, is_correct: chosen === s.verdict };
  });

  const correct_count = statement_results.filter((r) => r.is_correct).length;

  persistMessages(statement_results.map((r) => ({
    sessionId: input.sessionId, userId: input.userId, role: 'user' as const, msgType: 'text' as const,
    contentText: null,
    contentJson: { kind: 'reading_tfds_answer', statement_number: r.number, chosen: r.chosen, is_correct: r.is_correct },
  }))).catch(() => undefined);

  persistMessage({
    sessionId: input.sessionId, userId: input.userId, role: 'bob', msgType: 'evaluation',
    contentText: null,
    contentJson: { kind: 'reading_tfds_evaluation', score: correct_count, score_max: input.statements.length, statement_results, is_final: true },
  }).catch(() => undefined);

  return { correct_count, total: input.statements.length, statement_results };
}
