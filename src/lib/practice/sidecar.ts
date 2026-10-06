import { createSupabaseServer } from '@/lib/supabase/server';
import { fail, ok, type ActionResult } from '@/lib/result';
import type { CefrLevel } from '@/lib/types/practice';
import type { PracticeActivityMode, PracticeRubricDetail, PracticeSeed } from './types';

export interface PracticeSidecar {
  mode: PracticeActivityMode;
  level: CefrLevel | null;
  seed: PracticeSeed | null;
  endedAt: string | null;
}

/**
 * @param input.sessionId - canonical session the metadata belongs to
 * @returns metadata row linked to the session
 */
export async function createPracticeSidecar(input: {
  sessionId: string;
  userId: string;
  organizationId: string | null;
  mode: PracticeActivityMode;
  level: CefrLevel;
  seed: PracticeSeed;
}): Promise<ActionResult<null>> {
  const supabase = await createSupabaseServer();
  const { error } = await supabase.from('practice_sessions').insert({
    session_id: input.sessionId,
    user_id: input.userId,
    organization_id: input.organizationId,
    mode: input.mode,
    topic: input.seed.topic,
    cefr_level: input.level,
    seed: input.seed,
  });
  if (error) return fail('practice_sidecar_failed', true);
  return ok(null);
}

/** @param sessionId - canonical session id */
export async function getPracticeSidecar(sessionId: string): Promise<ActionResult<PracticeSidecar>> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('practice_sessions')
    .select('mode, cefr_level, seed, ended_at')
    .eq('session_id', sessionId)
    .maybeSingle();
  if (error) return fail('practice_sidecar_failed', true);
  if (!data) return fail('practice_sidecar_missing');
  return ok({
    mode: data.mode as PracticeActivityMode,
    level: (data.cefr_level as CefrLevel | null) ?? null,
    seed: (data.seed as PracticeSeed | null) ?? null,
    endedAt: (data.ended_at as string | null) ?? null,
  });
}

/**
 * @param input.turnCount - number of student turns
 * @param input.score - rubric grade 0-10
 * @param input.detail - rubric criteria
 */
export async function closePracticeSidecar(input: {
  sessionId: string;
  userId: string;
  turnCount: number;
  score: number;
  detail: PracticeRubricDetail;
}): Promise<ActionResult<null>> {
  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from('practice_sessions')
    .update({
      ended_at: new Date().toISOString(),
      turn_count: input.turnCount,
      rubric_score: input.score,
      rubric_detail: input.detail,
    })
    .eq('session_id', input.sessionId)
    .eq('user_id', input.userId);
  if (error) return fail('practice_sidecar_failed', true);
  return ok(null);
}

/** @param sessionId - session removed when the opening could not be fully persisted */
export async function discardPracticeSession(sessionId: string): Promise<void> {
  const supabase = await createSupabaseServer();
  await supabase.from('sessions').delete().eq('id', sessionId);
}
