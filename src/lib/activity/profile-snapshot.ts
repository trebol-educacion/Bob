import type { createSupabaseServer } from '@/lib/supabase/server';

export type ProfileSnapshotSupabase = Awaited<ReturnType<typeof createSupabaseServer>>;

export interface ProfileSnapshot {
  organizationId: string | null;
  allowVoiceStorage: boolean;
}

const EMPTY_SNAPSHOT: ProfileSnapshot = { organizationId: null, allowVoiceStorage: false };

/**
 * @param supabase ProfileSnapshotSupabase
 * @param userId string
 * @returns Promise<ProfileSnapshot>
 */
export async function getProfileSnapshot(
  supabase: ProfileSnapshotSupabase,
  userId: string,
): Promise<ProfileSnapshot> {
  const { data: profile, error: profileError } = await supabase
    .schema('public').from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .single();

  if (profileError || !profile?.organization_id) return EMPTY_SNAPSHOT;

  const { data: org, error: orgError } = await supabase
    .schema('public').from('organizations')
    .select('allow_voice_storage')
    .eq('id', profile.organization_id)
    .single();

  if (orgError || !org) return { organizationId: profile.organization_id, allowVoiceStorage: false };

  return {
    organizationId: profile.organization_id,
    allowVoiceStorage: org.allow_voice_storage === true,
  };
}
