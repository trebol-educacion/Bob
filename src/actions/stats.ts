'use server';

import { createSupabaseServer } from '@/lib/supabase/server';

export interface StudentStatRow {
  mode: string;
  sessions_count: number;
  avg_score: number;
  score_max: number;
  last_done: string;
}

export interface StudentStatsResult {
  rows: StudentStatRow[];
  total_sessions: number;
  global_avg: number | null;
  session_dates: string[];
}

export async function getStudentStatsAction(): Promise<StudentStatsResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { rows: [], total_sessions: 0, global_avg: null, session_dates: [] };

  const { data: activityRows } = await supabase
    .from('bob_activity_results')
    .select('mode, score_10, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const results = activityRows ?? [];

  const byMode = new Map<string, { scoredSum: number; scoredCount: number; totalCount: number; last: string }>();
  for (const r of results) {
    const mode = r.mode as string;
    const score10 = r.score_10 as number | null;
    const prev = byMode.get(mode);
    if (prev) {
      prev.totalCount += 1;
      if (score10 !== null) {
        prev.scoredSum += score10;
        prev.scoredCount += 1;
      }
    } else {
      byMode.set(mode, {
        scoredSum: score10 !== null ? score10 : 0,
        scoredCount: score10 !== null ? 1 : 0,
        totalCount: 1,
        last: r.created_at as string,
      });
    }
  }

  const rows: StudentStatRow[] = Array.from(byMode.entries()).map(([mode, v]) => ({
    mode,
    sessions_count: v.totalCount,
    avg_score: v.scoredCount > 0
      ? Math.round((v.scoredSum / v.scoredCount) * 10) / 10
      : 0,
    score_max: 10,
    last_done: v.last,
  }));

  rows.sort((a, b) => (a.last_done < b.last_done ? 1 : -1));

  const totalSessions = rows.reduce((s, r) => s + r.sessions_count, 0);

  const scoredResults = results.filter((r) => (r.score_10 as number | null) !== null);
  const globalAvg = scoredResults.length > 0
    ? Math.round(
        (scoredResults.reduce((s, r) => s + (r.score_10 as number), 0) / scoredResults.length) * 10,
      ) / 10
    : null;

  const sessionDates = results.map((r) => r.created_at as string);

  return {
    rows,
    total_sessions: totalSessions,
    global_avg: globalAvg,
    session_dates: sessionDates,
  };
}

/**
 * Hard-delete all sessions of the current student. Cascades to bob_messages
 * thanks to ON DELETE CASCADE.
 */
export async function resetStudentHistoryAction(): Promise<{ deleted: number }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { deleted: 0 };
  const { data, error } = await supabase
    .from('bob_sessions')
    .delete()
    .eq('user_id', user.id)
    .select('id');
  if (error) throw new Error(`[resetStudentHistoryAction] ${error.message}`);
  return { deleted: (data ?? []).length };
}
