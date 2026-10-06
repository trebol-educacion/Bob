'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import { emptyStudentStats, mapProgressSummary, type StudentStatsResult } from '@/lib/stats/progress-summary';

export interface StudentStatsPeriod {
  from?: string;
  to?: string;
}

/**
 * @param period StudentStatsPeriod
 * @returns Promise<StudentStatsResult>
 */
export async function getStudentStatsAction(period?: StudentStatsPeriod): Promise<StudentStatsResult> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc('progress_summary', {
    p_from: period?.from ?? null,
    p_to: period?.to ?? null,
  });
  if (error) return emptyStudentStats();
  return mapProgressSummary(data);
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
    .from('sessions')
    .delete()
    .eq('user_id', user.id)
    .select('id');
  if (error) throw new Error(`[resetStudentHistoryAction] ${error.message}`);
  return { deleted: (data ?? []).length };
}
