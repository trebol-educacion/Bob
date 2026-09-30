import { createSupabaseServer } from '@/lib/supabase/server';

const LINK_WINDOW_MS = 3 * 60 * 60 * 1000;

/**
 * @param userId session owner
 * @param mode session mode of the source part
 * @returns topic of the most recent session in the window, or null
 */
export async function readRecentSessionTopic(userId: string, mode: string): Promise<string | null> {
  const since = new Date(Date.now() - LINK_WINDOW_MS).toISOString();
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('sessions')
    .select('topic')
    .eq('user_id', userId)
    .eq('mode', mode)
    .not('topic', 'is', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const topic = (data as { topic: string | null }).topic;
  return topic && topic.trim() ? topic : null;
}
