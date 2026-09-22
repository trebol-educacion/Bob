'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import { inferSkillFromMode, inferModeMetadata } from '@/lib/skill-from-mode';

/** Reports active usage seconds for the current mode. Never throws — returns `{ ok: false }` on any failure. */
export async function trackUsageAction(mode: string, seconds: number): Promise<{ ok: boolean }> {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false };

    const skill = inferSkillFromMode(mode);
    const { cefr_level } = inferModeMetadata(mode);

    const { error } = await supabase.rpc('track_usage', {
      p_mode: mode,
      p_skill: skill,
      p_cefr_level: cefr_level,
      p_seconds: seconds,
    });

    if (error) return { ok: false };
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
