/**
 * Skill levels — constants and caller helpers shared by readers/writers.
 */

import { createSupabaseServer } from '@/lib/supabase/server';
import type { Skill } from '@/lib/types/skills';
import { inferSkillFromMode as inferSkillFromModeBase } from '@/lib/skill-from-mode';

export const SESSIONS_WINDOW = 5;
export const IMPROVEMENT_THRESHOLD = 0.85;

export const HIGH_LEVELS = new Set(['b2', 'c1', 'c2']);

export function inferSkillFromMode(mode: string): Skill {
  return inferSkillFromModeBase(mode) ?? 'speaking';
}

export const TEACHER_ROLES = new Set(['teacher', 'school_admin', 'super_admin']);

export async function resolveCallerContext(supabase: Awaited<ReturnType<typeof createSupabaseServer>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .schema('public').from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) return null;
  return { userId: user.id, role: profile.role as string, orgId: profile.organization_id as string | null };
}

