import 'server-only';

import { createSupabaseServer } from '@/lib/supabase/server';

const RECENT_WINDOW = 20;

interface PlanJson {
  exercise?: { groupId?: unknown } | null;
  bank_group_id?: unknown;
}

/**
 * @param userId
 * @param examPart
 * @returns bank group ids from the user's most recent plans of the part
 */
export async function recentGroupIds(userId: string, examPart: string): Promise<string[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('messages')
    .select('content_json')
    .eq('user_id', userId)
    .eq('content_json->>exam_part', examPart)
    .order('created_at', { ascending: false })
    .limit(RECENT_WINDOW);
  if (error || !data) return [];
  return data
    .map((row) => {
      const json = row.content_json as PlanJson | null;
      return json?.exercise?.groupId ?? json?.bank_group_id;
    })
    .filter((id): id is string => typeof id === 'string');
}
