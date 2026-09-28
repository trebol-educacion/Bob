'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import {
  isPracticeRepositoryDegraded,
  markPracticeRepositoryDegraded,
  markPracticeRepositoryHealthy,
} from '@/lib/practice/repository-health';
import type { CefrLevel } from '@/lib/types/practice';
import type {
  PracticeActivityMode,
  PracticeSeed,
  PracticeSession,
  PracticeMessage,
  PracticeImage,
  PracticeRubricDetail,
  PracticeResult,
} from '@/lib/practice/types';

/** @param error { code?: string; message?: string } | null */
function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || /relation .* does not exist/i.test(error.message ?? '');
}

/** @param error { code?: string; message?: string } | null */
function handleRepositoryError(error: { code?: string; message?: string } | null): { ok: false; code: string; degraded?: boolean } {
  if (isMissingTableError(error)) {
    markPracticeRepositoryDegraded();
    return { ok: false, code: 'degraded', degraded: true };
  }
  return { ok: false, code: error?.message ?? 'unknown_error' };
}

const DEGRADED_RESULT = { ok: false as const, code: 'degraded', degraded: true as const };

export async function createPracticeSessionAction(input: {
  mode: PracticeActivityMode;
  topic: string | null;
  cefrLevel: CefrLevel | null;
  seed: PracticeSeed;
  organizationId: string | null;
}): Promise<PracticeResult<PracticeSession>> {
  if (isPracticeRepositoryDegraded()) return DEGRADED_RESULT;
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, code: 'unauthenticated' };

    const { data, error } = await supabase
      .from('practice_sessions')
      .insert({
        user_id: user.id,
        organization_id: input.organizationId,
        mode: input.mode,
        topic: input.topic,
        cefr_level: input.cefrLevel,
        seed: input.seed,
      })
      .select()
      .single();

    if (error) return handleRepositoryError(error);
    markPracticeRepositoryHealthy();
    return { ok: true, data: data as PracticeSession };
  } catch (e) {
    return { ok: false, code: String(e) };
  }
}

export async function addPracticeTurnAction(input: {
  sessionId: string;
  role: 'bob' | 'student';
  content: string;
  audioUrl?: string | null;
  hintUsed?: boolean;
  modelAnswerUsed?: boolean;
}): Promise<PracticeResult<PracticeMessage>> {
  if (isPracticeRepositoryDegraded()) return DEGRADED_RESULT;
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, code: 'unauthenticated' };

    const { data, error } = await supabase
      .from('practice_messages')
      .insert({
        session_id: input.sessionId,
        user_id: user.id,
        role: input.role,
        content: input.content,
        audio_url: input.audioUrl ?? null,
        hint_used: input.hintUsed ?? false,
        model_answer_used: input.modelAnswerUsed ?? false,
      })
      .select()
      .single();

    if (error) return handleRepositoryError(error);
    markPracticeRepositoryHealthy();
    return { ok: true, data: data as PracticeMessage };
  } catch (e) {
    return { ok: false, code: String(e) };
  }
}

export async function savePracticeImageAction(input: {
  sessionId: string;
  prompt: string;
  imageUrl: string;
  model: string;
}): Promise<PracticeResult<PracticeImage>> {
  if (isPracticeRepositoryDegraded()) return DEGRADED_RESULT;
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, code: 'unauthenticated' };

    const { data, error } = await supabase
      .from('practice_images')
      .insert({
        session_id: input.sessionId,
        user_id: user.id,
        prompt: input.prompt,
        image_url: input.imageUrl,
        model: input.model,
      })
      .select()
      .single();

    if (error) return handleRepositoryError(error);
    markPracticeRepositoryHealthy();
    return { ok: true, data: data as PracticeImage };
  } catch (e) {
    return { ok: false, code: String(e) };
  }
}

const OPEN_SESSION_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export async function findOpenPracticeSessionAction(): Promise<PracticeResult<PracticeSession | null>> {
  if (isPracticeRepositoryDegraded()) return DEGRADED_RESULT;
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, code: 'unauthenticated' };

    const cutoff = new Date(Date.now() - OPEN_SESSION_MAX_AGE_MS).toISOString();

    const { data, error } = await supabase
      .from('practice_sessions')
      .select()
      .eq('user_id', user.id)
      .is('ended_at', null)
      .gte('started_at', cutoff)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return handleRepositoryError(error);
    markPracticeRepositoryHealthy();
    return { ok: true, data: (data as PracticeSession | null) ?? null };
  } catch (e) {
    return { ok: false, code: String(e) };
  }
}

export async function listPracticeMessagesAction(sessionId: string): Promise<PracticeResult<PracticeMessage[]>> {
  if (isPracticeRepositoryDegraded()) return DEGRADED_RESULT;
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, code: 'unauthenticated' };

    const { data, error } = await supabase
      .from('practice_messages')
      .select()
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) return handleRepositoryError(error);
    markPracticeRepositoryHealthy();
    return { ok: true, data: (data as PracticeMessage[]) ?? [] };
  } catch (e) {
    return { ok: false, code: String(e) };
  }
}

export async function updatePracticeModeAction(input: {
  sessionId: string;
  mode: PracticeActivityMode;
  topic: string;
}): Promise<PracticeResult<null>> {
  if (isPracticeRepositoryDegraded()) return DEGRADED_RESULT;
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, code: 'unauthenticated' };

    const { error } = await supabase
      .from('practice_sessions')
      .update({ mode: input.mode, topic: input.topic })
      .eq('id', input.sessionId)
      .eq('user_id', user.id);

    if (error) return handleRepositoryError(error);
    markPracticeRepositoryHealthy();
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, code: String(e) };
  }
}

export async function closePracticeSessionAction(input: {
  sessionId: string;
  rubricScore: number;
  rubricDetail: PracticeRubricDetail;
}): Promise<PracticeResult<null>> {
  if (isPracticeRepositoryDegraded()) return DEGRADED_RESULT;
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, code: 'unauthenticated' };

    const { count } = await supabase
      .from('practice_messages')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', input.sessionId);

    const { error } = await supabase
      .from('practice_sessions')
      .update({
        ended_at: new Date().toISOString(),
        turn_count: count ?? 0,
        rubric_score: input.rubricScore,
        rubric_detail: input.rubricDetail,
      })
      .eq('id', input.sessionId)
      .eq('user_id', user.id);

    if (error) return handleRepositoryError(error);
    markPracticeRepositoryHealthy();
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, code: String(e) };
  }
}
