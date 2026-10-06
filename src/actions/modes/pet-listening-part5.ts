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

export type WhyKey = 'A' | 'B' | 'C';

const AudioTurnSchema = z.object({
  speaker: z.enum(['M', 'W']),
  line: z.string(),
});

const WhyOptionsSchema = z.object({
  A: z.string(),
  B: z.string(),
  C: z.string().optional(),
});

const StatementSchema = z
  .object({
    number: z.number().int().min(1).max(6),
    text: z.string(),
    is_true: z.boolean(),
    why_options: WhyOptionsSchema.optional(),
    why_correct: z.enum(['A', 'B', 'C']).optional(),
  })
  .refine((s) => s.is_true || (s.why_options !== undefined && s.why_correct !== undefined), {
    message: 'False statements require why_options and why_correct',
  });

const GenerationSchema = z.object({
  context: z.string(),
  audio: z.array(AudioTurnSchema).min(2),
  statements: z.array(StatementSchema).length(6),
});

export type PETJustifyAudioTurn = z.infer<typeof AudioTurnSchema>;
export type PETJustifyStatement = z.infer<typeof StatementSchema>;

/** A single statement as sent to the client: keeps why_options for the UI but never the keys. */
export interface PETJustifyClientStatement {
  number: number;
  text: string;
  why_options?: { A: string; B: string; C?: string };
}

/** Full result returned from generatePETListeningTrueFalseJustifyAction. */
export interface PETListeningTrueFalseJustifyResult {
  planToken: string;
  framingText: string;
  context: string;
  audio: PETJustifyAudioTurn[];
  statements: PETJustifyClientStatement[];
}

/** Per-statement deterministic result after submit. */
export interface PETJustifyStatementResult {
  number: number;
  text: string;
  chosen_verdict: 'T' | 'F' | null;
  correct_verdict: 'T' | 'F';
  verdict_correct: boolean;
  why_options?: { A: string; B: string; C?: string };
  chosen_why: WhyKey | null;
  correct_why: WhyKey | null;
  why_correct: boolean | null;
  points: number;
  points_max: number;
}

/** Full submit result. */
export interface PETListeningTrueFalseJustifySubmitResult {
  sessionId: string;
  score: number;
  score_max: number;
  correct_count: number;
  total: number;
  statement_results: PETJustifyStatementResult[];
  audio: PETJustifyAudioTurn[];
}

interface ClientAnswer {
  verdict: 'T' | 'F' | null;
  why?: WhyKey | null;
}

function buildAudioText(turns: PETJustifyAudioTurn[]): string {
  return turns.map((t) => `${t.speaker === 'M' ? 'Man' : 'Woman'}: ${t.line}`).join('\n');
}

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Generates one PET B1 Listening Part 5 exercise: a ~150-word interview plus 6
 * true/false statements, false ones carrying a justification correction. Returns
 * statements WITHOUT the verdict/why keys and with empty audio; keys stay
 * server-side and the TTS audio is synthesized off the critical path. Creates a
 * session when none is provided.
 */
export async function generatePETListeningTrueFalseJustifyAction(): Promise<PETListeningTrueFalseJustifyResult | { error: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'unauthenticated' };

  const [generationPrompt, framingText] = await Promise.all([
    getPrompt('cambridge_pet_listening_part5_b1_generation').catch(() => null),
    getPrompt('cambridge_pet_listening_part5_b1_framing').catch(
      () =>
        'Vas a escuchar una entrevista. Lee cada frase y decide si es Verdadera o Falsa según lo que oyes. Si marcas Falsa, elige también por qué es falsa entre las opciones.'
    ),
  ]);

  const cleanFramingText = stripDashes(framingText);

  if (!generationPrompt) return { error: 'Could not load generation prompt' };

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_pet_listening_part5_b1_generation', model: MODELS.FLASH_LITE, userId },
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

  const cleanStatements: PETJustifyStatement[] = parsed.statements.map((s) => ({
    number: s.number,
    text: stripDashes(s.text),
    is_true: s.is_true,
    ...(s.why_options
      ? {
          why_options: {
            A: stripDashes(s.why_options.A),
            B: stripDashes(s.why_options.B),
            ...(s.why_options.C !== undefined ? { C: stripDashes(s.why_options.C) } : {}),
          },
        }
      : {}),
    ...(s.why_correct ? { why_correct: s.why_correct } : {}),
  }));

  const clientStatements: PETJustifyClientStatement[] = cleanStatements.map((s) => ({
    number: s.number,
    text: s.text,
    ...(s.why_options ? { why_options: s.why_options } : {}),
  }));

  const plan = {
    kind: 'pet_listening_tf_justify_plan',
    framing_text: cleanFramingText,
    context: stripDashes(parsed.context),
    audio: parsed.audio,
    statements: cleanStatements,
  };

  return {
    planToken: sealPlan(plan, userId),
    framingText: cleanFramingText,
    context: stripDashes(parsed.context),
    audio: parsed.audio,
    statements: clientStatements,
  };
}

/** Generates the TTS audio for the long interview stimulus, off the critical path. */
export async function generatePETListeningTrueFalseJustifyAudioAction(input: {
  audio: PETJustifyAudioTurn[];
}): Promise<{ data: string; mimeType: string }> {
  return generateSpeechAction(buildAudioText(input.audio));
}

/**
 * Evaluates answers deterministically against the server-side keys re-read from
 * the persisted plan, then creates the session on this first turn and closes it. No LLM involved. Scoring convention:
 * each statement is worth 1 point for a true statement (correct verdict), and 2
 * points for a false statement, 1 for the correct verdict plus 1 for the correct
 * justification, only awarded when the verdict was also right. correct_count
 * counts statements fully right (verdict, and justification when false).
 */
export async function submitPETListeningTrueFalseJustifyAction(input: {
  sessionId?: string;
  planToken: string;
  answers: Record<number, ClientAnswer>;
}): Promise<PETListeningTrueFalseJustifySubmitResult | { error: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'unauthenticated' };
  const plan = unsealPlan<{
    audio?: PETJustifyAudioTurn[];
    statements?: PETJustifyStatement[];
  }>(input.planToken, userId);
  const planStatements = plan?.statements;
  const audio = plan?.audio ?? [];
  if (!planStatements || planStatements.length === 0) return { error: 'Could not load exercise' };

  const statement_results: PETJustifyStatementResult[] = planStatements.map((s) => {
    const correct_verdict: 'T' | 'F' = s.is_true ? 'T' : 'F';
    const answer = input.answers[s.number] ?? { verdict: null };
    const chosen_verdict = answer.verdict ?? null;
    const verdict_correct = chosen_verdict === correct_verdict;

    if (s.is_true) {
      return {
        number: s.number,
        text: s.text,
        chosen_verdict,
        correct_verdict,
        verdict_correct,
        chosen_why: null,
        correct_why: null,
        why_correct: null,
        points: verdict_correct ? 1 : 0,
        points_max: 1,
      };
    }

    const correct_why = (s.why_correct ?? null) as WhyKey | null;
    const chosen_why = answer.why ?? null;
    const why_correct = verdict_correct ? chosen_why === correct_why : false;

    return {
      number: s.number,
      text: s.text,
      chosen_verdict,
      correct_verdict,
      verdict_correct,
      ...(s.why_options ? { why_options: s.why_options } : {}),
      chosen_why,
      correct_why,
      why_correct,
      points: (verdict_correct ? 1 : 0) + (why_correct ? 1 : 0),
      points_max: 2,
    };
  });

  const score = statement_results.reduce((acc, r) => acc + r.points, 0);
  const score_max = statement_results.reduce((acc, r) => acc + r.points_max, 0);
  const correct_count = statement_results.filter(
    (r) => r.verdict_correct && (r.correct_verdict === 'T' || r.why_correct === true)
  ).length;
  const total = planStatements.length;

  const completed = await completeActivity({
    mode: 'cambridge_pet_listening_part5',
    sessionId: input.sessionId,
    plan,
    answers: statement_results.map((r) => ({
      kind: 'pet_listening_tf_justify_answer',
      statement_number: r.number,
      chosen_verdict: r.chosen_verdict,
      chosen_why: r.chosen_why,
      verdict_correct: r.verdict_correct,
      why_correct: r.why_correct,
      points: r.points,
    })),
    evaluation: {
      kind: 'pet_listening_tf_justify_evaluation',
      score,
      score_max,
      correct_count,
      total,
      statement_results,
      audio,
    },
  });
  if (!completed.ok) return { error: completed.code };

  return { sessionId: completed.data.sessionId, score, score_max, correct_count, total, statement_results, audio };
}
