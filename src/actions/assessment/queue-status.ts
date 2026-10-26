'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import type { AssessmentQueueStatus } from './types';
import { assessmentQueueWindowSince } from '@/lib/assessment/queue-freshness';
import {
  deriveAssessmentQueueStatus,
  emptyAssessmentQueueStatus,
  type AssessmentQueueRow,
} from '@/lib/assessment/queue-status';

/**
 * @returns Promise<AssessmentQueueStatus>
 */
export async function getAssessmentQueueStatusAction(): Promise<AssessmentQueueStatus> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return emptyAssessmentQueueStatus();

  const { data, error } = await supabase
    .from('assessment_queue')
    .select('skill, assessment_id, status, started_at, created_at')
    .eq('user_id', user.id)
    .gte('created_at', assessmentQueueWindowSince())
    .order('created_at', { ascending: false });

  if (error) return emptyAssessmentQueueStatus();
  return deriveAssessmentQueueStatus((data ?? []) as AssessmentQueueRow[]);
}
