'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import { ClosedItemSchema } from '@/lib/types/practice';
import type { ClosedItem } from '@/lib/types/practice';

interface GetClosedItemsInput {
  framework: string;
  exam_part: string;
  cefr_level: string | null;
}

/** Fetches closed-comprehension items from bob_closed_items for the given context. */
export async function getClosedItemsAction(
  input: GetClosedItemsInput
): Promise<{ items: ClosedItem[] } | { error: string }> {
  try {
    const supabase = await createSupabaseServer();

    let query = supabase
      .from('bob_closed_items')
      .select('*')
      .eq('framework', input.framework)
      .eq('exam_part', input.exam_part);

    if (input.cefr_level !== null) {
      query = query.eq('cefr_level', input.cefr_level);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[getClosedItemsAction] Supabase error:', error.message);
      return { error: error.message };
    }

    const items: ClosedItem[] = [];
    for (const row of data ?? []) {
      const parsed = ClosedItemSchema.safeParse(row);
      if (parsed.success) {
        items.push(parsed.data);
      } else {
        console.warn('[getClosedItemsAction] Discarding invalid row:', row.id, parsed.error.issues);
      }
    }

    return { items };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[getClosedItemsAction] Unexpected error:', message);
    return { error: message };
  }
}
