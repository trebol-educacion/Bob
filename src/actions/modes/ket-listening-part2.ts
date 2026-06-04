'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { persistMessage, persistMessages } from '@/lib/persist-activity';
import { createSessionAction } from '@/actions/sessions';
import { createSupabaseServer } from '@/lib/supabase/server';
import { generateSpeechAction } from '@/actions/gemini';
import { MODELS } from '@/lib/models';

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
  sessionId: string;
  userId: string;
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

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Accepts exact matches and minor typos (distance ≤ 1 for short answers, ≤ 2 for longer). */
function isAccepted(userInput: string, answer: string): boolean {
  const a = normalize(userInput);
  const b = normalize(answer);
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

export async function generateKETListenCompleteAction(input: {
  sessionId?: string;
}): Promise<ListenCompleteResult | { error: string }> {
  let sessionId = input.sessionId;
  let userId: string | undefined;

  if (!sessionId) {
    const result = await createSessionAction({
      mode: 'cambridge_ket_listening_part2',
      title: 'KET Listening Part 2 — Listen and Complete',
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
    getPrompt('cambridge_ket_listening_part2_a2_generation').catch(() => null),
    getPrompt('cambridge_ket_listening_part2_a2_framing').catch(
      () => 'You will hear someone speaking. Listen and complete the form below. Write ONE word, number, date or time in each gap.'
    ),
  ]);

  if (!generationPrompt) return { error: 'Could not load generation prompt' };

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_ket_listening_part2_a2_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
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

  const audioResult = await generateSpeechAction(parsed.transcript).catch(() => ({
    data: '',
    mimeType: 'audio/L16;codec=pcm;rate=24000',
  }));

  const exercise: ListenCompleteExercise = {
    context: parsed.context,
    form_title: parsed.form_title,
    transcript: parsed.transcript,
    gaps: parsed.gaps,
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
      kind: 'listen_complete_plan',
      framing_text: framingText,
      exercise: {
        context: exercise.context,
        form_title: exercise.form_title,
        transcript: exercise.transcript,
        gaps: exercise.gaps,
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

export async function submitKETListenCompleteAction(input: {
  sessionId: string;
  userId: string;
  answers: Record<number, string>;
  exercise: Omit<ListenCompleteExercise, 'audio_b64' | 'audio_mime'>;
}): Promise<ListenCompleteSubmitResult | { error: string }> {
  const gap_results: GapResult[] = input.exercise.gaps.map((gap) => {
    const user_input = (input.answers[gap.number] ?? '').trim();
    return {
      number: gap.number,
      label: gap.label,
      user_input,
      correct_answer: gap.answer,
      is_correct: isAccepted(user_input, gap.answer),
    };
  });

  const correct_count = gap_results.filter((r) => r.is_correct).length;

  persistMessages(
    gap_results.map((r) => ({
      sessionId: input.sessionId,
      userId: input.userId,
      role: 'user' as const,
      msgType: 'text' as const,
      contentText: null,
      contentJson: {
        kind: 'listen_complete_answer',
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
      kind: 'listen_complete_evaluation',
      score: correct_count,
      score_max: input.exercise.gaps.length,
      gap_results,
      is_final: true,
    },
  }).catch(() => undefined);

  return { correct_count, total: input.exercise.gaps.length, gap_results };
}
