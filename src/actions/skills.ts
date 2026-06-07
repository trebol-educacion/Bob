'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import type { Skill, SkillLevel, SkillLevelMap, SkillLevelHistoryEntry } from '@/lib/types/skills';
import type { CefrLevel } from '@/lib/types/practice';
import { inferSkillFromMode as inferSkillFromModeBase } from '@/lib/skill-from-mode';

const SESSIONS_WINDOW = 5;
const IMPROVEMENT_THRESHOLD = 0.85;

const HIGH_LEVELS = new Set(['b2', 'c1', 'c2']);

function inferSkillFromMode(mode: string): Skill {
  return inferSkillFromModeBase(mode) ?? 'speaking';
}

/**
 * Returns true when the student shows sustained improvement for the given skill:
 * avg accuracy ≥ 85% across the last 5 scored sessions, current level < B2,
 * and assessment cooldown expired.
 */
export async function detectSustainedImprovementAction(skill: Skill): Promise<boolean> {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const [skillLevelResult, profileResult] = await Promise.all([
      supabase
        .from('bob_skill_levels')
        .select('cefr_level')
        .eq('user_id', user.id)
        .eq('skill', skill)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle(),
    ]);

    if (skillLevelResult.error || !skillLevelResult.data) return false;

    const level = skillLevelResult.data.cefr_level;
    if (HIGH_LEVELS.has(level)) return false;

    const [historyResult, cooldownResult] = await Promise.all([
      supabase
        .from('bob_skill_level_history')
        .select('occurred_at')
        .eq('user_id', user.id)
        .eq('skill', skill)
        .eq('origin', 'assessment')
        .order('occurred_at', { ascending: false })
        .limit(1),
      profileResult.data?.organization_id
        ? supabase
            .from('organizations')
            .select('assessment_cooldown_days')
            .eq('id', profileResult.data.organization_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const lastAssessmentAt = historyResult.data?.[0]?.occurred_at ?? null;
    const cooldownDays = (cooldownResult.data as { assessment_cooldown_days?: number } | null)?.assessment_cooldown_days ?? 7;

    if (lastAssessmentAt) {
      const elapsedMs = Date.now() - new Date(lastAssessmentAt).getTime();
      const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
      if (elapsedMs < cooldownMs) return false;
    }

    const { data: recentSessions } = await supabase
      .from('bob_sessions')
      .select('id, mode')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!recentSessions || recentSessions.length === 0) return false;

    const skillSessions = (recentSessions as Array<{ id: string; mode: string }>)
      .filter((s) => inferSkillFromMode(s.mode) === skill);

    if (skillSessions.length < SESSIONS_WINDOW) return false;

    const recentIds = skillSessions.slice(0, SESSIONS_WINDOW * 3).map((s) => s.id);

    const { data: evals } = await supabase
      .from('bob_messages')
      .select('session_id, content_json')
      .in('session_id', recentIds)
      .eq('msg_type', 'evaluation');

    const sessionScores = new Map<string, { score: number; score_max: number }>();
    for (const ev of evals ?? []) {
      const cj = (ev.content_json ?? {}) as Record<string, unknown>;
      if (
        cj.is_final === true
        && typeof cj.score === 'number'
        && typeof cj.score_max === 'number'
        && (cj.score_max as number) > 0
      ) {
        sessionScores.set(ev.session_id as string, {
          score: cj.score as number,
          score_max: cj.score_max as number,
        });
      }
    }

    const scored = skillSessions
      .filter((s) => sessionScores.has(s.id))
      .slice(0, SESSIONS_WINDOW);

    if (scored.length < SESSIONS_WINDOW) return false;

    const avg = scored.reduce((sum, s) => {
      const e = sessionScores.get(s.id)!;
      return sum + e.score / e.score_max;
    }, 0) / SESSIONS_WINDOW;

    return avg >= IMPROVEMENT_THRESHOLD;
  } catch {
    return false;
  }
}

const TEACHER_ROLES = new Set(['teacher', 'school_admin', 'super_admin']);

async function resolveCallerContext(supabase: Awaited<ReturnType<typeof createSupabaseServer>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) return null;
  return { userId: user.id, role: profile.role as string, orgId: profile.organization_id as string | null };
}

/**
 * Returns the skill level map for a given student.
 * Caller must be the student themselves, or a teacher/admin in the same organization.
 */
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
        .from('profiles')
        .select('organization_id')
        .eq('id', userId)
        .maybeSingle();

      if (!studentProfile || studentProfile.organization_id !== caller.orgId) return null;
    }

    const { data, error } = await supabase
      .from('bob_skill_levels')
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

/**
 * Returns the level change history for a student, optionally filtered by skill.
 * Caller must be the student or a teacher/admin in the same organization.
 */
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
        .from('profiles')
        .select('organization_id')
        .eq('id', userId)
        .maybeSingle();

      if (!studentProfile || studentProfile.organization_id !== caller.orgId) return [];
    }

    let query = supabase
      .from('bob_skill_level_history')
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

export interface StudentSkillSummary {
  user_id: string;
  skills: SkillLevelMap;
}

/**
 * Returns skill level summaries for all students in an organization.
 * Only accessible to teachers and admins of that organization.
 */
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
      .from('profiles')
      .select('id')
      .eq('organization_id', orgId)
      .eq('role', 'student');

    if (profilesError || !studentProfiles) return { ok: false, code: 'unauthorized' };

    const studentIds = studentProfiles.map((p) => p.id);
    if (studentIds.length === 0) return { ok: true, students: [] };

    const { data: levels, error: levelsError } = await supabase
      .from('bob_skill_levels')
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

/**
 * Manually sets a student's skill level. Only teachers and admins in the same organization
 * may call this. The trigger writes the history entry automatically.
 */
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
      .from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .maybeSingle();

    if (!studentProfile || studentProfile.organization_id !== caller.orgId) return { ok: false };

    const { error } = await supabase
      .from('bob_skill_levels')
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

/**
 * Student self-resets their own level for a skill (used when re-evaluating
 * from the navbar chip). Removes the row so the next entry forces the
 * Assessment invite again.
 */
export async function resetOwnSkillLevelAction(skill: Skill): Promise<{ ok: boolean }> {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false };

    const { error } = await supabase
      .from('bob_skill_levels')
      .delete()
      .eq('user_id', user.id)
      .eq('skill', skill);

    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

/**
 * Student self-sets a default level for a skill (used when skipping the
 * Assessment with "Start with A1"). Writes origin='default' so the trigger
 * registers it in the history.
 */
export async function applyDefaultSkillLevelAction(
  skill: Skill,
  cefrLevel: CefrLevel = 'a1',
): Promise<{ ok: boolean }> {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false };

    const { error } = await supabase
      .from('bob_skill_levels')
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
