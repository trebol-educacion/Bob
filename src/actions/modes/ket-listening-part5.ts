'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { stripDashes } from '@/lib/text';
import { callGemini, isOk } from '@/lib/gemini-client';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';
import { withoutAudio } from '@/lib/ket/plan';
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
  sessionId: string;
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

export async function generateKETTFDSAction(): Promise<TFDSResult | { error: string }> {
  const userId = (await currentUserId()) ?? undefined;
  if (!userId) return { error: 'Not authenticated' };

  const [generationPrompt, framingText] = await Promise.all([
    getPrompt('cambridge_ket_listening_part5_a2_generation').catch(() => null),
    getPrompt('cambridge_ket_listening_part5_a2_framing').catch(
      () =>
        'You will hear someone speaking. Read the statements and decide: is each one True, False, or does the speaker not say? Choose T, F or DS for each one.'
    ),
  ]);

  if (!generationPrompt) return { error: 'Could not load generation prompt' };

  const cleanFramingText = stripDashes(framingText);

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_ket_listening_part5_a2_generation', model: MODELS.FLASH_LITE, userId },
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

  const cleanStatements = parsed.statements.map((s) => ({ ...s, text: stripDashes(s.text) }));

  const exercise: TFDSExercise = {
    context: stripDashes(parsed.context),
    audio: parsed.audio,
    statements: cleanStatements,
    audio_b64: '',
    audio_mime: 'audio/L16;codec=pcm;rate=24000',
  };

  return {
    framing_text: cleanFramingText,
    exercise,
  };
}

/** Generates the TTS audio for the TFDS monologue, off the critical path. */
export async function generateKETTFDSAudioAction(input: {
  audio: AudioTurn[];
}): Promise<{ data: string; mimeType: string }> {
  return generateSpeechAction(buildAudioText(input.audio));
}

export async function submitKETTFDSAction(input: {
  sessionId?: string;
  framing_text: string;
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

  const completed = await completeActivity({
    mode: 'cambridge_ket_listening_part5',
    sessionId: input.sessionId,
    plan: { kind: 'tfds_plan', framing_text: input.framing_text, exercise: withoutAudio(input.exercise) },
    answers: statement_results.map((r) => ({
        kind: 'tfds_answer',
        statement_number: r.number,
        chosen: r.chosen,
        is_correct: r.is_correct,
      })),
    evaluation: {
      kind: 'tfds_evaluation',
      score: correct_count,
      score_max: input.exercise.statements.length,
      statement_results,
      audio: input.exercise.audio,
      is_final: true,
    },
  });
  if (!completed.ok) return { error: completed.code };

  return {
    sessionId: completed.data.sessionId,
    correct_count,
    total: input.exercise.statements.length,
    statement_results,
    audio: input.exercise.audio,
  };
}
