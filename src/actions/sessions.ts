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
    return { data: data as BobSession[], error: null };
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
