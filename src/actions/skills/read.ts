'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import type { Skill, SkillLevel, SkillLevelMap, SkillLevelHistoryEntry } from '@/lib/types/skills';
import type { CefrLevel } from '@/lib/types/practice';
import { resolveCallerContext, TEACHER_ROLES } from './shared';
import type { StudentSkillSummary } from './types';

export async function getSkillLevelsAction(userId: string): Promise<SkillLevelMap | null> {
  try {
    const supabase = await createSupabaseServer();
    const caller = await resolveCallerContext(supabase);
    if (!caller) return null;

    const isSelf = caller.userId === userId;
    const isTeacher = TEACHER_ROLES.has(caller.role);

    if (!isSelf && !isTeacher) return null;

    if (!isSelf && isTeacher) {
      const { data: studentProfile } = await supabase
        .schema('public').from('profiles')
        .select('organization_id')
        .eq('id', userId)
        .maybeSingle();

      if (!studentProfile || studentProfile.organization_id !== caller.orgId) return null;
    }

    const { data, error } = await supabase
      .from('skill_levels')
      .select('skill, cefr_level, origin, confidence, last_assessment_at, updated_at')
      .eq('user_id', userId);

    if (error) return null;

    const map: SkillLevelMap = {};
    for (const row of data ?? []) {
      map[row.skill as Skill] = {
        cefr_level: row.cefr_level as CefrLevel,
        origin: row.origin as SkillLevel['origin'],
        confidence: row.confidence as number | null,
        last_assessment_at: row.last_assessment_at,
        updated_at: row.updated_at,
      };
    }
    return map;
  } catch {
    return null;
  }
}

export async function getSkillLevelHistoryAction(
  userId: string,
  skill?: Skill,
  limit = 50,
): Promise<SkillLevelHistoryEntry[]> {
  try {
    const supabase = await createSupabaseServer();
    const caller = await resolveCallerContext(supabase);
    if (!caller) return [];

    const isSelf = caller.userId === userId;
    const isTeacher = TEACHER_ROLES.has(caller.role);

    if (!isSelf && !isTeacher) return [];

    if (!isSelf && isTeacher) {
      const { data: studentProfile } = await supabase
        .schema('public').from('profiles')
        .select('organization_id')
        .eq('id', userId)
        .maybeSingle();

      if (!studentProfile || studentProfile.organization_id !== caller.orgId) return [];
    }

    let query = supabase
      .from('skill_level_history')
      .select('id, user_id, skill, previous_level, new_level, origin, assessment_id, occurred_at')
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false })
      .limit(limit);

    if (skill) {
      query = query.eq('skill', skill);
    }

    const { data, error } = await query;
    if (error) return [];

    return (data ?? []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      skill: row.skill as Skill,
      previous_level: row.previous_level,
      new_level: row.new_level,
      origin: row.origin as SkillLevelHistoryEntry['origin'],
      occurred_at: row.occurred_at,
      assessment_id: row.assessment_id,
    }));
  } catch {
    return [];
  }
}

export async function getStudentsOverview(
  orgId: string,
): Promise<{ ok: false; code: 'unauthorized' } | { ok: true; students: StudentSkillSummary[] }> {
  try {
    const supabase = await createSupabaseServer();
    const caller = await resolveCallerContext(supabase);
    if (!caller) return { ok: false, code: 'unauthorized' };

    if (!TEACHER_ROLES.has(caller.role) || caller.orgId !== orgId) {
      return { ok: false, code: 'unauthorized' };
    }

    const { data: studentProfiles, error: profilesError } = await supabase
      .schema('public').from('profiles')
      .select('id')
      .eq('organization_id', orgId)
      .eq('role', 'student');

    if (profilesError || !studentProfiles) return { ok: false, code: 'unauthorized' };

    const studentIds = studentProfiles.map((p) => p.id);
    if (studentIds.length === 0) return { ok: true, students: [] };

    const { data: levels, error: levelsError } = await supabase
      .from('skill_levels')
      .select('user_id, skill, cefr_level, origin, confidence, last_assessment_at, updated_at')
      .in('user_id', studentIds);

    if (levelsError) return { ok: false, code: 'unauthorized' };

    const byStudent = new Map<string, SkillLevelMap>();
    for (const id of studentIds) byStudent.set(id, {});

    for (const row of levels ?? []) {
      const map = byStudent.get(row.user_id)!;
      map[row.skill as Skill] = {
        cefr_level: row.cefr_level as CefrLevel,
        origin: row.origin as SkillLevel['origin'],
        confidence: row.confidence as number | null,
        last_assessment_at: row.last_assessment_at,
        updated_at: row.updated_at,
      };
    }

    return {
      ok: true,
      students: studentIds.map((id) => ({ user_id: id, skills: byStudent.get(id)! })),
    };
  } catch {
    return { ok: false, code: 'unauthorized' };
  }
}

