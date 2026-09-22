'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import { hasPendingAssessment } from '@/actions/assessment/queue-guard';
import { resolveLevelPolicy, isLevelSelectorTesterEnabled } from '@/lib/levels/level-policy';
import type { Skill } from '@/lib/types/skills';
import type { CefrLevel } from '@/lib/types/practice';
import { resolveCallerContext, TEACHER_ROLES } from './shared';

export async function setSkillLevelManualAction(
  userId: string,
  skill: Skill,
  cefrLevel: CefrLevel,
): Promise<{ ok: boolean }> {
  try {
    const supabase = await createSupabaseServer();
    const caller = await resolveCallerContext(supabase);
    if (!caller || !TEACHER_ROLES.has(caller.role)) return { ok: false };

    const { data: studentProfile } = await supabase
      .schema('public').from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .maybeSingle();

    if (!studentProfile || studentProfile.organization_id !== caller.orgId) return { ok: false };

    const { error } = await supabase
      .from('skill_levels')
      .upsert(
        {
          user_id: userId,
          skill,
          cefr_level: cefrLevel,
          origin: 'manual_teacher',
          confidence: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,skill' },
      );

    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

export async function resetOwnSkillLevelAction(skill: Skill): Promise<{ ok: boolean }> {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false };

    const { error } = await supabase
      .from('skill_levels')
      .delete()
      .eq('user_id', user.id)
      .eq('skill', skill);

    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

export async function applyDefaultSkillLevelAction(
  skill: Skill,
  cefrLevel: CefrLevel = 'a1',
): Promise<{ ok: boolean; code?: 'assessment_pending' | 'level_locked' }> {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false };

    if (await hasPendingAssessment(supabase, user.id, skill)) {
      return { ok: false, code: 'assessment_pending' };
    }

    const { data: profile } = await supabase
      .schema('public').from('profiles')
      .select('cefr_level_locked, cefr_active_level')
      .eq('id', user.id)
      .maybeSingle();

    const levelPolicy = resolveLevelPolicy({
      cefrLevelLocked: profile?.cefr_level_locked ?? false,
      cefrActiveLevel: (profile?.cefr_active_level ?? null) as CefrLevel | null,
      testerOverrideEnabled: isLevelSelectorTesterEnabled(process.env.BOB_LEVEL_SELECTOR_ENABLED),
    });
    if (levelPolicy.skipPlacement && !levelPolicy.allowManualSelection) {
      return { ok: false, code: 'level_locked' };
    }

    const { error } = await supabase
      .from('skill_levels')
      .upsert(
        {
          user_id: user.id,
          skill,
          cefr_level: cefrLevel,
          origin: 'default',
          confidence: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,skill' },
      );

    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

export async function promoteSkillLevelAction(
  skill: Skill,
  cefrLevel: CefrLevel,
): Promise<{ ok: boolean }> {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false };

    const { error } = await supabase
      .from('skill_levels')
      .upsert(
        {
          user_id: user.id,
          skill,
          cefr_level: cefrLevel,
          origin: 'promotion',
          confidence: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,skill' },
      );

    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

