'use server';

import { createSupabaseServer } from '@/lib/supabase/server';

export type ProfileStageErrorCode = 'unauthenticated' | 'db_error';

export type ProfileStageResult =
  | { ok: true; data: { educationalStageId: string | null; gradeCode: string | null } }
  | { ok: false; code: ProfileStageErrorCode };

export async function fetchProfileStageAction(): Promise<ProfileStageResult> {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, code: 'unauthenticated' };

    const { data, error } = await supabase
      .from('profiles')
      .select('educational_stage_id, grade_code')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('[fetchProfileStageAction] Supabase error:', error.message);
      return { ok: false, code: 'db_error' };
    }

    return {
      ok: true,
      data: {
        educationalStageId: data?.educational_stage_id ?? null,
        gradeCode: data?.grade_code ?? null,
      },
    };
  } catch (err) {
    console.error('[fetchProfileStageAction] Unexpected error:', err instanceof Error ? err.message : err);
    return { ok: false, code: 'db_error' };
  }
}
