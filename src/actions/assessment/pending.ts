'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import type { Skill } from '@/lib/types/skills';
import type { PendingAssessmentsMap } from './types';

/**
 * Returns the most recent pending or processing queue row per skill for the current user.
 * Used by the dashboard to show "Evaluating…" overlay on SkillRing while the Edge Function works.
 */
export async function getPendingAssessmentsAction(): Promise<PendingAssessmentsMap> {
  const empty: PendingAssessmentsMap = { speaking: null, listening: null, reading: null, writing: null };

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return empty;

  const { data } = await supabase
    .from('assessment_queue')
    .select('skill, assessment_id, started_at')
    .eq('user_id', user.id)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false });

  const result: PendingAssessmentsMap = { speaking: null, listening: null, reading: null, writing: null };

  for (const row of (data ?? []) as Array<{ skill: string; assessment_id: string; started_at: string | null }>) {
    const skill = row.skill as Skill;
    if (result[skill] === null) {
      result[skill] = { assessment_id: row.assessment_id, started_at: row.started_at };
    }
  }

  return result;
}

