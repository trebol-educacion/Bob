'use server';

import { createSupabaseServer } from '@/lib/supabase/server';

/** A single completed challenge attempt, minimal projection for dashboard display. */
export type ChallengeAttempt = {
  id: string;
  framework: string;
  exam_id: string;
  exam_title: string;
  objective_correct: number;
  objective_total: number;
  created_at: string;
};

/** Persists a completed challenge attempt. Never throws — returns `{ ok: false }` on any failure. */
export async function saveChallengeAttemptAction(input: {
  framework: string;
  examId: string;
  examTitle: string;
  objectiveCorrect: number;
  objectiveTotal: number;
  answers: Record<string, Record<string, string>>;
  results: unknown;
}): Promise<{ ok: boolean }> {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false };

    const { error } = await supabase.from('challenge_attempts').insert({
      user_id: user.id,
      framework: input.framework,
      exam_id: input.examId,
      exam_title: input.examTitle,
      objective_correct: input.objectiveCorrect,
      objective_total: input.objectiveTotal,
      answers: input.answers,
      results: input.results,
    });

    if (error) {
      console.error('[saveChallengeAttemptAction]', error);
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.error('[saveChallengeAttemptAction]', err);
    return { ok: false };
  }
}

/** Returns the authenticated user's challenge attempts, newest first. Returns `[]` on any failure. */
export async function getChallengeAttemptsAction(): Promise<ChallengeAttempt[]> {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('challenge_attempts')
      .select('id, framework, exam_id, exam_title, objective_correct, objective_total, created_at')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as ChallengeAttempt[];
  } catch {
    return [];
  }
}
