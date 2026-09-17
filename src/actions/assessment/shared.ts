/**
 * Assessment — cooldown resolution shared across skills.
 */

import { createSupabaseServer } from '@/lib/supabase/server';

/**
 * Computes the next-available timestamp for re-taking an Assessment, honoring the
 * tenant's configured `assessment_cooldown_days` (falls back to 7 when unset).
 */
export async function resolveCooldownUntil(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  userId: string,
): Promise<string> {
  const { data: profile } = await supabase
    .schema('public').from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .maybeSingle();

  let cooldownDays = 7;
  if (profile?.organization_id) {
    const { data: org } = await supabase
      .schema('public').from('organizations')
      .select('assessment_cooldown_days')
      .eq('id', profile.organization_id)
      .maybeSingle();
    cooldownDays = org?.assessment_cooldown_days ?? 7;
  }

  return new Date(Date.now() + cooldownDays * 24 * 60 * 60 * 1000).toISOString();
}

