'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { persistMessage, persistMessages } from '@/lib/persist-activity';
import { createSessionAction } from '@/actions/sessions';
import { createSupabaseServer } from '@/lib/supabase/server';
import { generateSpeechAction } from '@/actions/gemini';
import { MODELS } from '@/lib/models';

export type Verdict = 'T' | 'F' | 'DS';

const AudioTurnSchema = z.object({
  speaker: z.enum(['M', 'W']),
  line: z.string(),
});

const StatementSchema = z.object({
  number: z.number().int().min(1).max(5),
  text: z.string(),
  verdict: z.enum(['T', 'F', 'DS']),
});

const GenerationSchema = z.object({
  context: z.string(),
  audio: z.array(AudioTurnSchema).min(1),
  statements: z.array(StatementSchema).length(5),
});

export type AudioTurn = z.infer<typeof AudioTurnSchema>;
export type Statement = z.infer<typeof StatementSchema>;

export interface TFDSExercise {
  context: string;
  audio: AudioTurn[];
  statements: Statement[];
  audio_b64: string;
  audio_mime: string;
}

export interface TFDSResult {
  sessionId: string;
  userId: string;
  framing_text: string;
  exercise: TFDSExercise;
}

export interface StatementResult {
  number: number;
  text: string;
  chosen: Verdict | null;
  correct_verdict: Verdict;
  is_correct: boolean;
}

export interface TFDSSubmitResult {
  correct_count: number;
  total: number;
  statement_results: StatementResult[];
  audio: AudioTurn[];
}

function buildAudioText(turns: AudioTurn[]): string {
  if (turns.length === 1) return turns[0].line;
  return turns
    .map((t) => `${t.speaker === 'M' ? 'Man' : 'Woman'}: ${t.line}`)
    .join('\n');
}

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function generateKETTFDSAction(input: {
  sessionId?: string;
}): Promise<TFDSResult | { error: string }> {
  let sessionId = input.sessionId;
  let userId: string | undefined;

  if (!sessionId) {
    const result = await createSessionAction({
      mode: 'cambridge_ket_listening_part5',
      title: 'Listening Part 5 — True, False or Doesn\'t Say',
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
    getPrompt('cambridge_ket_listening_part5_a2_generation').catch(() => null),
    getPrompt('cambridge_ket_listening_part5_a2_framing').catch(
      () =>
        'You will hear someone speaking. Read the statements and decide: is each one True, False, or does the speaker not say? Choose T, F or DS for each one.'
    ),
  ]);

  if (!generationPrompt) return { error: 'Could not load generation prompt' };

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_ket_listening_part5_a2_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: generationPrompt }] }],
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      })
  );

  if (!isOk(geminiResult)) return { error: 'Could not generate exercise' };

  const rawText = geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(GenerationSchema, rawText);
  if (!parsed) return { error: 'Unexpected model response' };

  const audioResult = await generateSpeechAction(buildAudioText(parsed.audio)).catch(
    () => ({ data: '', mimeType: 'audio/L16;codec=pcm;rate=24000' })
  );

  const exercise: TFDSExercise = {
    context: parsed.context,
    audio: parsed.audio,
    statements: parsed.statements,
    audio_b64: audioResult.data,
    audio_mime: audioResult.mimeType,
  };

  persistMessage({
    sessionId: sessionId!,
    userId: userId!,
    role: 'bob',
    msgType: 'text',
    contentText: null,
    contentJson: {
      kind: 'tfds_plan',
      framing_text: framingText,
      exercise: {
        context: exercise.context,
        audio: exercise.audio,
        statements: exercise.statements,
      },
    },
  }).catch(() => undefined);

  return {
    sessionId: sessionId!,
    userId: userId!,
    framing_text: framingText,
    exercise,
  };
}

export async function submitKETTFDSAction(input: {
  sessionId: string;
  userId: string;
  answers: Record<number, Verdict | null>;
  exercise: { statements: Statement[]; audio: AudioTurn[] };
}): Promise<TFDSSubmitResult | { error: string }> {
  const statement_results: StatementResult[] = input.exercise.statements.map((s) => {
    const chosen = input.answers[s.number] ?? null;
    return {
      number: s.number,
      text: s.text,
      chosen,
      correct_verdict: s.verdict,
      is_correct: chosen === s.verdict,
    };
  });

  const correct_count = statement_results.filter((r) => r.is_correct).length;

  persistMessages(
    statement_results.map((r) => ({
      sessionId: input.sessionId,
      userId: input.userId,
      role: 'user' as const,
      msgType: 'text' as const,
      contentText: null,
      contentJson: {
        kind: 'tfds_answer',
        statement_number: r.number,
        chosen: r.chosen,
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
      kind: 'tfds_evaluation',
      score: correct_count,
      score_max: input.exercise.statements.length,
      statement_results,
      audio: input.exercise.audio,
      is_final: true,
    },
  }).catch(() => undefined);

  return {
    correct_count,
    total: input.exercise.statements.length,
    statement_results,
    audio: input.exercise.audio,
  };
}
