'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { ensureSession, finishSession, recordTurn } from '@/lib/session/lifecycle';
import { MODELS } from '@/lib/models';

const FCE_CLOZE_MODE = 'cambridge_fce_reading_part1';

const ClozeOptionSchema = z.object({
  id: z.enum(['A', 'B', 'C', 'D']),
  text: z.string().min(1),
});

const ClozeGapSchema = z.object({
  number: z.number().int().min(1).max(8),
  options: z.array(ClozeOptionSchema).length(4),
  correct_option: z.enum(['A', 'B', 'C', 'D']),
  explanation: z.string().min(1),
});

const GenerationSchema = z.object({
  title: z.string().min(1),
  text_with_gaps: z.string().min(1),
  gaps: z.array(ClozeGapSchema).length(8),
});

export type ClozeOption = z.infer<typeof ClozeOptionSchema>;

/** A single gap in the cloze text. */
export interface ClozeGap {
  number: number;
  options: ClozeOption[];
  correct_option: 'A' | 'B' | 'C' | 'D';
  explanation: string;
}

/** The full cloze text with its gaps. */
export interface ClozeText {
  title: string;
  text_with_gaps: string;
  gaps: ClozeGap[];
}

/** Full result of a successful generation call. */
export interface FCEClozeResult {
  title: string;
  text_with_gaps: string;
  gaps: ClozeGap[];
  framingText: string;
}

/** Per-gap answer result returned after submit. */
export interface ClozeGapResult {
  number: number;
  chosen: 'A' | 'B' | 'C' | 'D';
  correct_option: 'A' | 'B' | 'C' | 'D';
  isCorrect: boolean;
  explanation: string;
}

/** Full submit result. */
export interface FCEClozeSubmitResult {
  sessionId: string;
  correctCount: number;
  total: number;
  results: ClozeGapResult[];
}

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Generates 1 FCE B2 multiple-choice cloze text with 8 gaps; persists nothing until the first submit. */
export async function generateFCEClozeAction(): Promise<FCEClozeResult | { error: string }> {
  const [generationPrompt, framingText] = await Promise.all([
    getPrompt('cambridge_fce_reading_part1_b2_generation').catch(() => null),
    getPrompt('cambridge_fce_reading_part1_b2_framing').catch(
      () =>
        'You will read a short text with 8 missing words. For each gap, choose the best option from A, B, C, or D. Read the WHOLE sentence, sometimes the answer depends on the words around the gap.'
    ),
  ]);

  if (!generationPrompt) {
    return { error: 'Could not load generation prompt' };
  }

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_fce_reading_part1_b2_generation', model: MODELS.FLASH_LITE_PREVIEW },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: generationPrompt }] }],
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      })
  );

  if (!isOk(geminiResult)) {
    return { error: 'Could not generate cloze text' };
  }

  const rawText = geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(GenerationSchema, rawText);

  if (!parsed) {
    console.error(JSON.stringify({ event: 'fce_cloze_parse_error', raw: rawText.slice(0, 200) }));
    return { error: 'Unexpected model response' };
  }

  return {
    title: parsed.title,
    text_with_gaps: parsed.text_with_gaps,
    gaps: parsed.gaps,
    framingText,
  };
}

/** Evaluates student answers deterministically (no LLM); creates the session on this first turn and closes it. */
export async function submitFCEClozeAnswersAction(input: {
  sessionId?: string;
  title: string;
  text_with_gaps: string;
  framingText: string;
  answers: Record<number, 'A' | 'B' | 'C' | 'D'>;
  gaps: ClozeGap[];
}): Promise<FCEClozeSubmitResult | { error: string }> {
  const results: ClozeGapResult[] = input.gaps.map((gap) => {
    const chosen = input.answers[gap.number] ?? 'A';
    return {
      number: gap.number,
      chosen,
      correct_option: gap.correct_option,
      isCorrect: chosen === gap.correct_option,
      explanation: gap.explanation,
    };
  });

  const correctCount = results.filter((r) => r.isCorrect).length;
  const total = input.gaps.length;

  const session = await ensureSession({ mode: FCE_CLOZE_MODE, sessionId: input.sessionId });
  if (!session.ok) return { error: session.code };

  const planMessages = session.data.created
    ? [
        {
          role: 'bob' as const,
          msgType: 'text' as const,
          contentText: null,
          contentJson: {
            kind: 'cloze_plan',
            title: input.title,
            text_with_gaps: input.text_with_gaps,
            gaps: input.gaps,
            framing_text: input.framingText,
          },
        },
      ]
    : [];

  const turn = await recordTurn({
    sessionId: session.data.sessionId,
    userId: session.data.userId,
    messages: [
      ...planMessages,
      ...results.map((r) => ({
        role: 'user' as const,
        msgType: 'text' as const,
        contentText: null,
        contentJson: { kind: 'cloze_answer', gap_number: r.number, chosen: r.chosen, isCorrect: r.isCorrect },
      })),
    ],
  });
  if (!turn.ok) return { error: turn.code };

  const finished = await finishSession({
    sessionId: session.data.sessionId,
    userId: session.data.userId,
    evaluation: { kind: 'cloze_evaluation', score: correctCount, score_max: total, results },
  });
  if (!finished.ok) return { error: finished.code };

  return { sessionId: session.data.sessionId, correctCount, total, results };
}
