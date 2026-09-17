'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import type { Skill } from '@/lib/types/skills';
import { inferSkillFromMode, SESSIONS_WINDOW, IMPROVEMENT_THRESHOLD, HIGH_LEVELS } from './shared';

export async function detectSustainedImprovementAction(skill: Skill): Promise<boolean> {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const [skillLevelResult, profileResult] = await Promise.all([
      supabase
        .from('skill_levels')
        .select('cefr_level')
        .eq('user_id', user.id)
        .eq('skill', skill)
        .maybeSingle(),
      supabase
        .schema('public').from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle(),
    ]);

    if (skillLevelResult.error || !skillLevelResult.data) return false;

    const level = skillLevelResult.data.cefr_level;
    if (HIGH_LEVELS.has(level)) return false;

    const [historyResult, cooldownResult] = await Promise.all([
      supabase
        .from('skill_level_history')
        .select('occurred_at')
        .eq('user_id', user.id)
        .eq('skill', skill)
        .eq('origin', 'assessment')
        .order('occurred_at', { ascending: false })
        .limit(1),
      profileResult.data?.organization_id
        ? supabase
            .schema('public').from('organizations')
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
      .from('sessions')
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
      .from('messages')
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

