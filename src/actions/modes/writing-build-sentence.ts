'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import type { BuildSentenceItem } from '@/components/practice/BuildSentencePractice';

const MOCK_ITEMS: BuildSentenceItem[] = [
  {
    id: 'mock-1',
    prompt: 'Rearrange the words to form a correct sentence.',
    tokens: ['studying', 'been', 'She', 'has', 'hard'],
    target_sentence: 'She has been studying hard',
  },
  {
    id: 'mock-2',
    prompt: 'Build a sentence using all the tokens below.',
    tokens: ['the', 'environment', 'protect', 'We', 'must'],
    target_sentence: 'We must protect the environment',
  },
];

/** Fetches Build-a-Sentence items from bob_closed_items; returns mock items if none found. */
export async function getBuildSentenceItemsAction(): Promise<
  { items: BuildSentenceItem[] } | { error: string }
> {
  try {
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from('bob_closed_items')
      .select('id, stimulus_text, options, correct_key')
      .eq('framework', 'toefl')
      .eq('exam_part', 'toefl_writing_build_sentence');

    if (error) {
      console.error('[getBuildSentenceItemsAction] Supabase error:', error.message);
      return { items: MOCK_ITEMS };
    }

    if (!data || data.length === 0) {
      return { items: MOCK_ITEMS };
    }

    const items: BuildSentenceItem[] = (
      data as Array<{
        id: string;
        stimulus_text: string | null;
        options: Array<{ key: string; label: string }>;
        correct_key: string;
      }>
    ).map((row) => ({
      id: row.id,
      prompt: row.stimulus_text ?? 'Arrange the tokens to form a correct sentence.',
      tokens: row.options.map((o) => o.label),
      target_sentence: row.correct_key,
    }));

    return { items };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[getBuildSentenceItemsAction] Unexpected error:', message);
    return { items: MOCK_ITEMS };
  }
}
