'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import type { PracticeMode } from '@/lib/types/practice';

/** @deprecated Use PracticeMode from '@/lib/types/practice' directly. */
export type SessionMode = PracticeMode;

export interface BobSession {
  id: string;
  user_id: string;
  mode: PracticeMode;
  topic: string | null;
  title: string;
  created_at: string;
  updated_at: string;
  final_score?: number | null;
  final_score_max?: number | null;
}

export interface ActionResult<T> {
  data: T | null;
  error: string | null;
}

export async function createSessionAction(input: {
  mode: PracticeMode;
  topic?: string | null;
  title: string;
}): Promise<ActionResult<BobSession>> {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'unauthenticated' };

    const { data, error } = await supabase
      .from('bob_sessions')
      .insert({ user_id: user.id, mode: input.mode, topic: input.topic ?? null, title: input.title })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as BobSession, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

export async function getSessionsAction(): Promise<ActionResult<BobSession[]>> {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: [], error: null };

    const { data, error } = await supabase
      .from('bob_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) return { data: null, error: error.message };
    const sessions = (data ?? []) as BobSession[];
    if (sessions.length === 0) return { data: sessions, error: null };

    const ids = sessions.map((s) => s.id);
    const { data: evals } = await supabase
      .from('bob_messages')
      .select('session_id, content_json')
      .in('session_id', ids)
      .eq('msg_type', 'evaluation');

    const finalEvals = new Map<string, { score: number | null; score_max: number | null }>();
    for (const ev of evals ?? []) {
      const cj = (ev.content_json ?? {}) as Record<string, unknown>;
      if (cj.is_final === true) {
        finalEvals.set(ev.session_id as string, {
          score: typeof cj.score === 'number' ? cj.score : null,
          score_max: typeof cj.score_max === 'number' ? cj.score_max : null,
        });
      }
    }

    const enriched = sessions.map((s) => {
      const fe = finalEvals.get(s.id);
      return {
        ...s,
        final_score: fe?.score ?? null,
        final_score_max: fe?.score_max ?? null,
      };
    });
    return { data: enriched, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

export async function deleteSessionAction(id: string): Promise<ActionResult<null>> {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'unauthenticated' };

    const { error } = await supabase
      .from('bob_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}
