'use server';

import { createSupabaseServer } from '@/lib/supabase/server';

type DeletableTable =
  | 'messages'
  | 'sessions'
  | 'activity_results'
  | 'usage_daily'
  | 'skill_levels'
  | 'skill_level_history'
  | 'challenge_attempts'
  | 'assessment_queue'
  | 'practice_sessions'
  | 'practice_messages'
  | 'practice_images';

export interface DeleteStudentDataCounts {
  deletedMessages: number;
  deletedSessions: number;
  deletedActivityResults: number;
  deletedUsageDaily: number;
  deletedSkillLevels: number;
  deletedSkillLevelHistory: number;
  deletedChallengeAttempts: number;
  deletedAssessmentQueue: number;
  deletedPracticeSessions: number;
  deletedPracticeMessages: number;
  deletedPracticeImages: number;
}

/** Borra todos los datos de práctica de un alumno y registra la acción en audit_log. */
export async function deleteStudentDataAction(
  targetStudentUserId: string
): Promise<
  | ({ ok: true } & DeleteStudentDataCounts)
  | { ok: false; error: string }
> {
  const supabase = await createSupabaseServer();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: 'unauthenticated' };

  const { data: actorProfile, error: profileError } = await supabase
    .schema('public').from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single();

  if (profileError || !actorProfile) return { ok: false, error: 'profile_not_found' };

  const allowedRoles = ['school_admin', 'super_admin'] as const;
  if (!allowedRoles.includes(actorProfile.role as typeof allowedRoles[number])) {
    return { ok: false, error: 'forbidden' };
  }

  const { data: targetProfile, error: targetError } = await supabase
    .schema('public').from('profiles')
    .select('organization_id')
    .eq('id', targetStudentUserId)
    .single();

  if (targetError || !targetProfile) return { ok: false, error: 'target_not_found' };

  if (
    actorProfile.role !== 'super_admin' &&
    actorProfile.organization_id !== targetProfile.organization_id
  ) {
    return { ok: false, error: 'forbidden' };
  }

  const tables: DeletableTable[] = [
    'messages',
    'sessions',
    'activity_results',
    'usage_daily',
    'skill_levels',
    'skill_level_history',
    'challenge_attempts',
    'assessment_queue',
    'practice_sessions',
    'practice_messages',
    'practice_images',
  ];

  const counts: Record<DeletableTable, number> = {
    messages: 0,
    sessions: 0,
    activity_results: 0,
    usage_daily: 0,
    skill_levels: 0,
    skill_level_history: 0,
    challenge_attempts: 0,
    assessment_queue: 0,
    practice_sessions: 0,
    practice_messages: 0,
    practice_images: 0,
  };

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .delete({ count: 'exact' })
      .eq('user_id', targetStudentUserId);

    if (error) return { ok: false, error: error.message };
    counts[table] = count ?? 0;
  }

  const { data: practiceImageFiles } = await supabase.storage
    .from('bob-practice-images')
    .list(targetStudentUserId);

  if (practiceImageFiles && practiceImageFiles.length > 0) {
    await supabase.storage
      .from('bob-practice-images')
      .remove(practiceImageFiles.map((f) => `${targetStudentUserId}/${f.name}`));
  }

  const { error: auditError } = await supabase
    .from('audit_log')
    .insert({
      action: 'student_data_deleted',
      actor_user_id: user.id,
      target_user_id: targetStudentUserId,
      organization_id: actorProfile.organization_id,
      details: counts,
    });

  if (auditError) return { ok: false, error: auditError.message };

  return {
    ok: true,
    deletedMessages: counts.messages,
    deletedSessions: counts.sessions,
    deletedActivityResults: counts.activity_results,
    deletedUsageDaily: counts.usage_daily,
    deletedSkillLevels: counts.skill_levels,
    deletedSkillLevelHistory: counts.skill_level_history,
    deletedChallengeAttempts: counts.challenge_attempts,
    deletedAssessmentQueue: counts.assessment_queue,
    deletedPracticeSessions: counts.practice_sessions,
    deletedPracticeMessages: counts.practice_messages,
    deletedPracticeImages: counts.practice_images,
  };
}
