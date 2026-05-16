'use server';

import { createSupabaseServer } from '@/lib/supabase/server';

/** Borra todos los datos de práctica de un alumno y registra la acción en audit_log. */
export async function deleteStudentDataAction(
  targetStudentUserId: string
): Promise<
  | { ok: true; deletedSessions: number; deletedMessages: number }
  | { ok: false; error: string }
> {
  const supabase = await createSupabaseServer();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: 'unauthenticated' };

  const { data: actorProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single();

  if (profileError || !actorProfile) return { ok: false, error: 'profile_not_found' };

  const allowedRoles = ['school_admin', 'super_admin'] as const;
  if (!allowedRoles.includes(actorProfile.role as typeof allowedRoles[number])) {
    return { ok: false, error: 'forbidden' };
  }

  const { data: targetProfile, error: targetError } = await supabase
    .from('profiles')
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

  const { count: deletedMessages, error: msgError } = await supabase
    .from('bob_messages')
    .delete({ count: 'exact' })
    .eq('user_id', targetStudentUserId);

  if (msgError) return { ok: false, error: msgError.message };

  const { count: deletedSessions, error: sessError } = await supabase
    .from('bob_sessions')
    .delete({ count: 'exact' })
    .eq('user_id', targetStudentUserId);

  if (sessError) return { ok: false, error: sessError.message };

  const msgs = deletedMessages ?? 0;
  const sess = deletedSessions ?? 0;

  const { error: auditError } = await supabase
    .from('audit_log')
    .insert({
      action: 'student_data_deleted',
      actor_user_id: user.id,
      target_user_id: targetStudentUserId,
      organization_id: actorProfile.organization_id,
      details: { deletedSessions: sess, deletedMessages: msgs },
    });

  if (auditError) return { ok: false, error: auditError.message };

  return { ok: true, deletedSessions: sess, deletedMessages: msgs };
}
