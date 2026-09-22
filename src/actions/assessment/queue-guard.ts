import type { createSupabaseServer } from '@/lib/supabase/server';
import type { Skill } from '@/lib/types/skills';

export type AssessmentQueueSupabase = Awaited<ReturnType<typeof createSupabaseServer>>;

/**
 * @param supabase AssessmentQueueSupabase
 * @param userId string
 * @param skill Skill
 * @returns Promise<boolean>
 */
export async function hasPendingAssessment(
  supabase: AssessmentQueueSupabase,
  userId: string,
  skill: Skill,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('assessment_queue')
    .select('id')
    .eq('user_id', userId)
    .eq('skill', skill)
    .in('status', ['pending', 'processing'])
    .limit(1);

  if (error) return false;
  return Boolean(data && data.length > 0);
}
