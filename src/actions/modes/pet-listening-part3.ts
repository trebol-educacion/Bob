'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { stripDashes } from '@/lib/text';
import { callGemini, isOk } from '@/lib/gemini-client';
import { completeActivity } from '@/lib/session/complete';
import { currentUserId } from '@/lib/session/lifecycle';
import { sealPlan, unsealPlan } from '@/lib/session/sealed-plan';
import { generateSpeechAction } from '@/actions/gemini';
import { MODELS } from '@/lib/models';
import { isAcceptedAnswer } from '@/lib/answer-match';

const GapSchema = z.object({
  number: z.number().int().min(1).max(6),
  answer: z.string(),
  accept: z.array(z.string()).default([]),
});

const GenerationSchema = z.object({
  context: z.string(),
  summary_title: z.string(),
  transcript: z.string(),
  summary: z.string(),
  gaps: z.array(GapSchema).length(6),
  word_bank: z.array(z.string()).min(6).max(12),
});

type GenerationGap = z.infer<typeof GapSchema>;

/** A gap as sent to the client: number only, never the answer key. */
export interface PETGapFillClientGap {
  number: number;
}

/** A single PET Listening Part 3 gap-fill exercise without the answer key. */
export interface PETGapFillExercise {
  context: string;
  summary_title: string;
  summary: string;
  gaps: PETGapFillClientGap[];
  word_bank: string[];
  audio_b64: string;
  audio_mime: string;
}

/** Full result returned from generatePETListeningGapFillAction. */
export interface PETListeningGapFillResult {
  planToken: string;
  framingText: string;
  exercise: PETGapFillExercise;
}

/** Per-gap deterministic result after submit. */
export interface PETGapFillGapResult {
  number: number;
  user_input: string;
  correct_answer: string;
  is_correct: boolean;
}

/** Full submit result. */
export interface PETListeningGapFillSubmitResult {
  sessionId: string;
  correct_count: number;
  total: number;
  gap_results: PETGapFillGapResult[];
}

/** Accepts the input if it equals the canonical answer or any listed alternative, case- and accent-insensitive. */
function isAccepted(userInput: string, gap: GenerationGap): boolean {
  return isAcceptedAnswer(userInput, [gap.answer, ...gap.accept]);
}

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Generates one PET B1 Listening Part 3 interactive gap-fill exercise.
 * Returns the exercise WITHOUT the answer key and with empty audio; the key
 * stays server-side and the TTS audio is synthesized off the critical path.
 */
export async function generatePETListeningGapFillAction(): Promise<PETListeningGapFillResult | { error: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'unauthenticated' };

  const [generationPrompt, framingText] = await Promise.all([
    getPrompt('cambridge_pet_listening_part3_b1_generation').catch(() => null),
    getPrompt('cambridge_pet_listening_part3_b1_framing').catch(
      () =>
        'Vas a escuchar una charla corta de una sola persona. Después, completa el resumen escribiendo o arrastrando la palabra que falta en cada hueco.'
    ),
  ]);

  const cleanFramingText = stripDashes(framingText);

  if (!generationPrompt) return { error: 'Could not load generation prompt' };

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_pet_listening_part3_b1_generation', model: MODELS.FLASH_LITE, userId },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE,
        contents: [{ role: 'user', parts: [{ text: generationPrompt }] }],
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      })
  );

  if (!isOk(geminiResult)) return { error: 'Could not generate exercise' };

  const rawText = geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(GenerationSchema, rawText);
  if (!parsed) return { error: 'Unexpected model response' };

  const cleanGaps = parsed.gaps.map((gap) => ({
    number: gap.number,
    answer: stripDashes(gap.answer),
    accept: gap.accept.map((alt) => stripDashes(alt)),
  }));

  const cleanWordBank = parsed.word_bank.map((w) => stripDashes(w));
  const cleanSummary = stripDashes(parsed.summary);
  const cleanSummaryTitle = stripDashes(parsed.summary_title);
  const cleanContext = stripDashes(parsed.context);

  const exercise: PETGapFillExercise = {
    context: cleanContext,
    summary_title: cleanSummaryTitle,
    summary: cleanSummary,
    gaps: cleanGaps.map((gap) => ({ number: gap.number })),
    word_bank: cleanWordBank,
    audio_b64: '',
    audio_mime: 'audio/L16;codec=pcm;rate=24000',
  };

  const plan = {
    kind: 'pet_listening_gapfill_plan',
    framing_text: cleanFramingText,
    exercise: {
      context: cleanContext,
      summary_title: cleanSummaryTitle,
      transcript: parsed.transcript,
      summary: cleanSummary,
      gaps: cleanGaps,
      word_bank: cleanWordBank,
    },
  };

  return {
    planToken: sealPlan(plan, userId),
    framingText: cleanFramingText,
    exercise,
  };
}

/** Generates the TTS audio for the monologue transcript from the sealed plan, off the critical path. */
export async function generatePETListeningGapFillAudioAction(input: {
  planToken: string;
}): Promise<{ data: string; mimeType: string }> {
  const empty = { data: '', mimeType: 'audio/L16;codec=pcm;rate=24000' };
  const userId = await currentUserId();
  if (!userId) return empty;
  const plan = unsealPlan<{ exercise?: { transcript?: string } }>(input.planToken, userId);
  const transcript = plan?.exercise?.transcript;
  if (!transcript) return empty;

  return generateSpeechAction(transcript);
}

/**
 * Evaluates answers deterministically against the server-side answer key and
 * persists results. No LLM involved; the key is re-read from the persisted plan.
 */
export async function submitPETListeningGapFillAction(input: {
  sessionId?: string;
  planToken: string;
  answers: Record<number, string>;
}): Promise<PETListeningGapFillSubmitResult | { error: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'unauthenticated' };
  const plan = unsealPlan<{ exercise?: { gaps?: GenerationGap[] } }>(input.planToken, userId);
  const planGaps = plan?.exercise?.gaps;
  if (!planGaps || planGaps.length === 0) return { error: 'Could not load exercise' };

  const gap_results: PETGapFillGapResult[] = planGaps.map((gap) => {
    const user_input = (input.answers[gap.number] ?? '').trim();
    return {
      number: gap.number,
      user_input,
      correct_answer: gap.answer,
      is_correct: isAccepted(user_input, gap),
    };
  });

  const correct_count = gap_results.filter((r) => r.is_correct).length;
  const total = planGaps.length;

  const completed = await completeActivity({
    mode: 'cambridge_pet_listening_part3',
    sessionId: input.sessionId,
    plan,
    answers: gap_results.map((r) => ({
      kind: 'pet_listening_gapfill_answer',
      gap_number: r.number,
      user_input: r.user_input,
      is_correct: r.is_correct,
    })),
    evaluation: {
      kind: 'pet_listening_gapfill_evaluation',
      score: correct_count,
      score_max: total,
      gap_results,
    },
  });
  if (!completed.ok) return { error: completed.code };

  return { sessionId: completed.data.sessionId, correct_count, total, gap_results };
}
