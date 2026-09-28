import 'server-only';

import { createSupabaseServer } from '@/lib/supabase/server';

/**
 * Atomically claims one pre-generated exercise for a mode (removing it from the
 * pool) and returns its payload, or null when the pool is empty. Uses a
 * SECURITY DEFINER `FOR UPDATE SKIP LOCKED` function so two learners never get
 * the same item. This keeps LLM/TTS/image generation off the critical path
 * (decision D-A1): entering an activity becomes a single fast read.
 */
export async function claimPooledExercise<T>(mode: string): Promise<T | null> {
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.rpc('claim_bob_exercise', { p_mode: mode });
    if (error || data == null) return null;
    return data as T;
  } catch {
    return null;
  }
}

/** Inserts freshly pre-generated exercise payloads into the pool for a mode. */
export async function addPooledExercises(mode: string, payloads: unknown[]): Promise<void> {
  if (payloads.length === 0) return;
  try {
    const supabase = await createSupabaseServer();
    await supabase.rpc('add_bob_exercises', { p_mode: mode, p_payloads: payloads });
  } catch {
    // Replenishment is best-effort; the live-generation fallback always works.
  }
}

/** Returns how many ready exercises remain in the pool for a mode. */
export async function countPooledExercises(mode: string): Promise<number> {
  try {
    const supabase = await createSupabaseServer();
    const { data } = await supabase.rpc('count_bob_exercises', { p_mode: mode });
    return typeof data === 'number' ? data : 0;
  } catch {
    return 0;
  }
}
