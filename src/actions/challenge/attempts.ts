'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import { getProfileSnapshot } from '@/lib/activity/profile-snapshot';
import type { PartResult } from '@/lib/challenge/scoring';

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

/**
 * @param framework string
 * @returns string | null
 */
function cefrLevelFromFramework(framework: string): string | null {
  const match = framework.match(/(pre_a1|a1|a2|b1|b2|c1|c2)$/);
  return match ? match[1] : null;
}

async function persistChallengeSectionResults(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  userId: string,
  input: { framework: string; examId: string; results: PartResult[] },
): Promise<void> {
  if (input.results.length === 0) return;

  const snapshot = await getProfileSnapshot(supabase, userId);
  const cefr_level = cefrLevelFromFramework(input.framework);

  const rows = input.results.map((r) => ({
    user_id: userId,
    session_id: null,
    message_id: null,
    mode: `challenge_${input.examId}_${r.id}`,
    framework: input.framework,
    exam_part: r.id,
    cefr_level,
    skill: r.skill,
    measure_type: r.kind === 'objective' ? ('score' as const) : ('rubric' as const),
    raw_score: r.kind === 'objective' ? r.correct : null,
    max_score: r.kind === 'objective' ? r.total : null,
    score_10: r.kind === 'objective' && r.total > 0 ? Math.round((r.correct / r.total) * 100) / 10 : null,
    rubric_json: null,
    organization_id: snapshot.organizationId,
  }));

  const { error } = await supabase.from('activity_results').insert(rows);
  if (error) console.error('[saveChallengeAttemptAction] activity_results insert failed:', error.message);
}

/** Persists a completed challenge attempt. Never throws, returns `{ ok: false }` on any failure. */
export async function saveChallengeAttemptAction(input: {
  framework: string;
  examId: string;
  examTitle: string;
  objectiveCorrect: number;
  objectiveTotal: number;
  answers: Record<string, Record<string, string>>;
  results: PartResult[];
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

    await persistChallengeSectionResults(supabase, user.id, input);

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
