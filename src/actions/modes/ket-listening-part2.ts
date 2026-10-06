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
import { normalizeAnswer } from '@/lib/answer-match';

const GapSchema = z.object({
  number: z.number().int().min(1).max(5),
  label: z.string(),
  answer: z.string(),
});

const GenerationSchema = z.object({
  context: z.string(),
  form_title: z.string(),
  transcript: z.string(),
  gaps: z.array(GapSchema).length(5),
});

export type Gap = z.infer<typeof GapSchema>;

export interface ListenCompleteExercise {
  context: string;
  form_title: string;
  transcript: string;
  gaps: Gap[];
  audio_b64: string;
  audio_mime: string;
}

export interface ListenCompleteResult {
  framing_text: string;
  exercise: ListenCompleteExercise;
}

export interface GapResult {
  number: number;
  label: string;
  user_input: string;
  correct_answer: string;
  is_correct: boolean;
}

export interface ListenCompleteSubmitResult {
  sessionId: string;
  correct_count: number;
  total: number;
  gap_results: GapResult[];
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Accepts exact matches and minor typos (distance ≤ 1 for short answers, ≤ 2 for longer). */
function isAccepted(userInput: string, answer: string): boolean {
  const a = normalizeAnswer(userInput);
  const b = normalizeAnswer(answer);
  if (a === b) return true;
  const maxDistance = b.length <= 5 ? 1 : 2;
  return levenshtein(a, b) <= maxDistance;
}

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function generateKETListenCompleteAction(): Promise<ListenCompleteResult | { error: string }> {
  const t0 = Date.now();
  const userId = (await currentUserId()) ?? undefined;
  if (!userId) return { error: 'Not authenticated' };

  const tSession = Date.now();

  const [generationPrompt, framingText] = await Promise.all([
    getPrompt('cambridge_ket_listening_part2_a2_generation').catch(() => null),
    getPrompt('cambridge_ket_listening_part2_a2_framing').catch(
      () => 'You will hear someone speaking. Listen and complete the form below. Write ONE word, number, date or time in each gap.'
    ),
  ]);

  const tPrompts = Date.now();

  const cleanFramingText = stripDashes(framingText);

  if (!generationPrompt) return { error: 'Could not load generation prompt' };

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_ket_listening_part2_a2_generation', model: MODELS.FLASH_LITE, userId },
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

  const tGemini = Date.now();
  console.info(
    `[ket-listening-part2] session=${tSession - t0}ms prompts=${tPrompts - tSession}ms gemini=${tGemini - tPrompts}ms total=${tGemini - t0}ms`
  );

  const cleanGaps = parsed.gaps.map((gap) => ({
    ...gap,
    label: stripDashes(gap.label),
    answer: stripDashes(gap.answer),
  }));

  const exercise: ListenCompleteExercise = {
    context: stripDashes(parsed.context),
    form_title: stripDashes(parsed.form_title),
    transcript: parsed.transcript,
    gaps: cleanGaps,
    audio_b64: '',
    audio_mime: 'audio/L16;codec=pcm;rate=24000',
  };

  return {
    framing_text: cleanFramingText,
    exercise,
  };
}

/** Generates the TTS audio for a Listen and Complete transcript, off the critical path. */
export async function generateKETListenCompleteAudioAction(input: {
  transcript: string;
}): Promise<{ data: string; mimeType: string }> {
  return generateSpeechAction(input.transcript);
}

export async function submitKETListenCompleteAction(input: {
  sessionId?: string;
  framing_text: string;
  answers: Record<number, string>;
  exercise: Omit<ListenCompleteExercise, 'audio_b64' | 'audio_mime'>;
}): Promise<ListenCompleteSubmitResult | { error: string }> {
  const gap_results: GapResult[] = input.exercise.gaps.map((gap) => {
    const user_input = (input.answers[gap.number] ?? '').trim();
    return {
      number: gap.number,
      label: stripDashes(gap.label),
      user_input,
      correct_answer: stripDashes(gap.answer),
      is_correct: isAccepted(user_input, gap.answer),
    };
  });

  const correct_count = gap_results.filter((r) => r.is_correct).length;

  const completed = await completeActivity({
    mode: 'cambridge_ket_listening_part2',
    sessionId: input.sessionId,
    plan: { kind: 'listen_complete_plan', framing_text: input.framing_text, exercise: withoutAudio(input.exercise) },
    answers: gap_results.map((r) => ({
        kind: 'listen_complete_answer',
        gap_number: r.number,
        user_input: r.user_input,
        is_correct: r.is_correct,
      })),
    evaluation: {
      kind: 'listen_complete_evaluation',
      score: correct_count,
      score_max: input.exercise.gaps.length,
      gap_results,
      is_final: true,
    },
  });
  if (!completed.ok) return { error: completed.code };

  return {
    sessionId: completed.data.sessionId, correct_count, total: input.exercise.gaps.length, gap_results };
}
