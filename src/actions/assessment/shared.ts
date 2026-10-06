import { createSupabaseServer } from '@/lib/supabase/server';

export const DEFAULT_ASSESSMENT_COOLDOWN_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

type AssessmentSupabase = Awaited<ReturnType<typeof createSupabaseServer>>;

/**
 * @param supabase AssessmentSupabase
 * @param userId string
 * @returns Promise<number> days from organizations.assessment_cooldown_days
 */
export async function resolveCooldownDays(supabase: AssessmentSupabase, userId: string): Promise<number> {
  const { data: profile } = await supabase
    .schema('public').from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .maybeSingle();

  if (!profile?.organization_id) return DEFAULT_ASSESSMENT_COOLDOWN_DAYS;

  const { data: org } = await supabase
    .schema('public').from('organizations')
    .select('assessment_cooldown_days')
    .eq('id', profile.organization_id)
    .maybeSingle();

  return org?.assessment_cooldown_days ?? DEFAULT_ASSESSMENT_COOLDOWN_DAYS;
}

/**
 * @param supabase AssessmentSupabase
 * @param userId string
 * @returns Promise<string> ISO timestamp of the next allowed attempt
 */
export async function resolveCooldownUntil(supabase: AssessmentSupabase, userId: string): Promise<string> {
  const days = await resolveCooldownDays(supabase, userId);
  return new Date(Date.now() + days * DAY_MS).toISOString();
}
