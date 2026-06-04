'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { persistMessage, persistMessages } from '@/lib/persist-activity';
import { createSessionAction } from '@/actions/sessions';
import { createSupabaseServer } from '@/lib/supabase/server';
import { MODELS } from '@/lib/models';

const OptionSchema = z.object({
  id: z.enum(['A', 'B', 'C']),
  text: z.string(),
});

const ShortTextItemSchema = z.object({
  number: z.number().int().min(1).max(5),
  text_body: z.string(),
  text_context: z.string(),
  question: z.string(),
  options: z.array(OptionSchema).length(3),
  correct_option: z.enum(['A', 'B', 'C']),
  explanation: z.string(),
});

const GenerationSchema = z.object({
  items: z.array(ShortTextItemSchema).min(5).max(5),
});

export type ShortTextOption = z.infer<typeof OptionSchema>;

/** A single short-text item as returned to the client. */
export interface ShortTextItem {
  number: number;
  text_body: string;
  text_context: string;
  question: string;
  options: ShortTextOption[];
  correct_option: 'A' | 'B' | 'C';
  explanation: string;
}

/** Full result of a successful generation call. */
export interface PETShortTextsResult {
  sessionId: string;
  userId: string;
  items: ShortTextItem[];
  framingText: string;
}

/** Per-item answer result returned after submit. */
export interface ShortTextAnswerResult {
  number: number;
  chosen: 'A' | 'B' | 'C';
  correct_option: 'A' | 'B' | 'C';
  isCorrect: boolean;
  explanation: string;
}

/** Full submit result. */
export interface PETShortTextsSubmitResult {
  correctCount: number;
  total: number;
  results: ShortTextAnswerResult[];
}

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Generates 5 PET B1 short-text items and a framing text; creates a session when none is provided. */
export async function generatePETShortTextsAction(input: {
  sessionId?: string;
}): Promise<PETShortTextsResult | { error: string }> {
  let sessionId = input.sessionId;
  let userId: string | undefined;

  if (!sessionId) {
    const result = await createSessionAction({
      mode: 'cambridge_pet_reading_part1',
      title: 'PET Reading Part 1 — Short Texts',
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
    getPrompt('cambridge_pet_reading_part1_b1_generation').catch(() => null),
    getPrompt('cambridge_pet_reading_part1_b1_framing').catch(
      () => 'You will read 5 short texts (notices, emails, messages, postcards). For each one, choose the meaning that fits best — A, B or C.'
    ),
  ]);

  if (!generationPrompt) {
    return { error: 'Could not load generation prompt' };
  }

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_pet_reading_part1_b1_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
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

  persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'text',
    contentText: null,
    contentJson: {
      kind: 'reading_prompt',
      items: parsed.items,
      framing_text: framingText,
    },
  }).catch(() => undefined);

  return {
    sessionId,
    userId,
    items: parsed.items,
    framingText,
  };
}

/** Evaluates student answers deterministically (no LLM) and persists results. */
export async function submitPETShortTextsAnswersAction(input: {
  sessionId: string;
  userId: string;
  answers: Record<number, 'A' | 'B' | 'C'>;
  items: ShortTextItem[];
}): Promise<PETShortTextsSubmitResult | { error: string }> {
  const results: ShortTextAnswerResult[] = input.items.map((item) => {
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
