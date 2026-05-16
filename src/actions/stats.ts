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
}

export async function getStudentStatsAction(): Promise<StudentStatsResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { rows: [], total_sessions: 0, global_avg: null };

  const { data: evalRows } = await supabase
    .from('bob_messages')
    .select('content_json, created_at, session_id, bob_sessions!inner(mode)')
    .eq('user_id', user.id)
    .eq('msg_type', 'evaluation')
    .order('created_at', { ascending: false });

  type EvalRow = {
    content_json: { is_final?: boolean; score?: number; score_max?: number } | null;
    created_at: string;
    bob_sessions: { mode: string | null } | null;
  };
  const finals = (evalRows ?? []).filter((r) => {
    const cj = (r as unknown as EvalRow).content_json;
    return cj?.is_final === true;
  }) as unknown as EvalRow[];

  const byMode = new Map<string, { sum: number; max: number; count: number; last: string }>();
  for (const r of finals) {
    const mode = r.bob_sessions?.mode ?? null;
    if (!mode) continue;
    const score = Number(r.content_json?.score ?? 0);
    const max = Number(r.content_json?.score_max ?? 100);
    const prev = byMode.get(mode);
    if (prev) {
      prev.sum += score;
      prev.max = max;
      prev.count += 1;
    } else {
      byMode.set(mode, { sum: score, max, count: 1, last: r.created_at });
    }
  }

  const rows: StudentStatRow[] = Array.from(byMode.entries()).map(([mode, v]) => ({
    mode,
    sessions_count: v.count,
    avg_score: Math.round((v.sum / v.count) * 10) / 10,
    score_max: v.max,
    last_done: v.last,
  }));

  rows.sort((a, b) => (a.last_done < b.last_done ? 1 : -1));

  const totalSessions = rows.reduce((s, r) => s + r.sessions_count, 0);
  const totalScore = finals.reduce((s, r) => s + Number(r.content_json?.score ?? 0), 0);
  const globalAvg = finals.length > 0
    ? Math.round((totalScore / finals.length) * 10) / 10
    : null;

  return { rows, total_sessions: totalSessions, global_avg: globalAvg };
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
