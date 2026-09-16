'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { stripDashes } from '@/lib/text';
import { callGemini, isOk } from '@/lib/gemini-client';
import { persistMessage, persistMessages } from '@/lib/persist-activity';
import { createSessionAction } from '@/actions/sessions';
import { createSupabaseServer } from '@/lib/supabase/server';
import { generateSpeechAction } from '@/actions/gemini';
import { MODELS } from '@/lib/models';

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
  sessionId: string;
  userId: string;
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
  correct_count: number;
  total: number;
  gap_results: PETGapFillGapResult[];
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Accepts the input if it equals the canonical answer or any listed alternative, case- and accent-insensitive. */
function isAccepted(userInput: string, gap: GenerationGap): boolean {
  const candidate = normalize(userInput);
  if (candidate === '') return false;
  if (candidate === normalize(gap.answer)) return true;
  return gap.accept.some((alt) => normalize(alt) === candidate);
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
 * Creates a session when none is provided.
 */
export async function generatePETListeningGapFillAction(input: {
  sessionId?: string;
}): Promise<PETListeningGapFillResult | { error: string }> {
  let sessionId = input.sessionId;
  let userId: string | undefined;

  if (!sessionId) {
    const result = await createSessionAction({
      mode: 'cambridge_pet_listening_part3',
      title: 'Listening Part 3: Interactive Gap-Fill',
    });
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

  persistMessage({
    sessionId: sessionId!,
    userId: userId!,
    role: 'bob',
    msgType: 'text',
    contentText: null,
    contentJson: {
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
    },
  }).catch(() => undefined);

  return {
    sessionId: sessionId!,
    userId: userId!,
    framingText: cleanFramingText,
    exercise,
  };
}

/** Generates the TTS audio for the monologue transcript, off the critical path. */
export async function generatePETListeningGapFillAudioAction(input: {
  sessionId: string;
  userId: string;
}): Promise<{ data: string; mimeType: string }> {
  const supabase = await createSupabaseServer();

  const { data: planRow, error } = await supabase
    .from('bob_messages')
    .select('content_json')
    .eq('session_id', input.sessionId)
    .eq('user_id', input.userId)
    .eq('role', 'bob')
    .eq('msg_type', 'text')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (error || !planRow) return { data: '', mimeType: 'audio/L16;codec=pcm;rate=24000' };

  const cj = planRow.content_json as { exercise?: { transcript?: string } } | null;
  const transcript = cj?.exercise?.transcript;
  if (!transcript) return { data: '', mimeType: 'audio/L16;codec=pcm;rate=24000' };

  return generateSpeechAction(transcript);
}

/**
 * Evaluates answers deterministically against the server-side answer key and
 * persists results. No LLM involved; the key is re-read from the persisted plan.
 */
export async function submitPETListeningGapFillAction(input: {
  sessionId: string;
  userId: string;
  answers: Record<number, string>;
}): Promise<PETListeningGapFillSubmitResult | { error: string }> {
  const supabase = await createSupabaseServer();

  const { data: planRow, error } = await supabase
    .from('bob_messages')
    .select('content_json')
    .eq('session_id', input.sessionId)
    .eq('user_id', input.userId)
    .eq('role', 'bob')
    .eq('msg_type', 'text')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (error || !planRow) return { error: 'Could not load exercise' };

  const cj = planRow.content_json as { exercise?: { gaps?: GenerationGap[] } } | null;
  const planGaps = cj?.exercise?.gaps;
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

  persistMessages(
    gap_results.map((r) => ({
      sessionId: input.sessionId,
      userId: input.userId,
      role: 'user' as const,
      msgType: 'text' as const,
      contentText: null,
      contentJson: {
        kind: 'pet_listening_gapfill_answer',
        gap_number: r.number,
        user_input: r.user_input,
        is_correct: r.is_correct,
      },
    }))
  ).catch(() => undefined);

  persistMessage({
    sessionId: input.sessionId,
    userId: input.userId,
    role: 'bob',
    msgType: 'evaluation',
    contentText: null,
    contentJson: {
      kind: 'pet_listening_gapfill_evaluation',
      score: correct_count,
      score_max: total,
      gap_results,
      is_final: true,
    },
  }).catch(() => undefined);

  return { correct_count, total, gap_results };
}
