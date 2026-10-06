'use server';

import { pickContent } from '@/lib/item-bank/content-source';
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
    const picked = await pickContent({
      framework: 'toefl',
      cefr: input.cefr_level,
      examPart: input.exam_part,
      purpose: 'practice',
      skill: 'listening',
    });
    if (!picked.ok) {
      return { error: picked.code };
    }

    const items: ClosedItem[] = picked.data.items;

    return { items };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[getClosedItemsAction] Unexpected error:', message);
    return { error: message };
  }
}
