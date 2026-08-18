import 'server-only';
import { createSupabaseServer } from '@/lib/supabase/server';

export interface VocabPick {
  word: string;
  category: string;
}

export type CefrLevel = 'pre_a1' | 'a1' | 'a2' | 'b1' | 'b2' | 'c1';

interface PickOptions {
  framework?: string;
  cefr_level: CefrLevel;
  count: number;
  distinctCategories?: boolean;
  pointableOnly?: boolean;
  examPart?: string | null;
}

/**
 * Picks vocabulary rows from `bob_vocabulary` for an activity.
 * Differs from the YL-internal helper: `pointable` is OFF by default so
 * non-visual activities (Situation, conversation) get the full pool.
 */
export async function pickVocabulary(opts: PickOptions): Promise<VocabPick[]> {
  const {
    framework = 'cambridge',
    cefr_level,
    count,
    distinctCategories = true,
    pointableOnly = false,
    examPart,
  } = opts;

  const supabase = await createSupabaseServer();
  let query = supabase
    .from('vocabulary')
    .select('word, category')
    .eq('framework', framework)
    .eq('cefr_level', cefr_level);

  if (pointableOnly) query = query.eq('pointable', true);
  if (examPart) query = query.eq('exam_part', examPart);

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    console.warn('[pickVocabulary] empty pool', { framework, cefr_level, error });
    return [];
  }

  const rows = data as VocabPick[];
  const shuffled = [...rows].sort(() => Math.random() - 0.5);
  if (!distinctCategories) return shuffled.slice(0, count);

  const picked: VocabPick[] = [];
  const usedCategories = new Set<string>();
  for (const row of shuffled) {
    if (picked.length === count) break;
    if (usedCategories.has(row.category)) continue;
    picked.push(row);
    usedCategories.add(row.category);
  }
  for (const row of shuffled) {
    if (picked.length === count) break;
    if (picked.includes(row)) continue;
    picked.push(row);
  }
  return picked;
}

/**
 * Converts a list of words into a `{WORD_1, WORD_2, ...}` variable map for
 * prompt template substitution.
 */
export function wordsToPromptVars(words: string[]): Record<string, string> {
  const vars: Record<string, string> = {};
  words.forEach((w, i) => {
    vars[`WORD_${i + 1}`] = w;
  });
  return vars;
}
