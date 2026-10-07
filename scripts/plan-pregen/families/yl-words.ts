import type { SlotContext } from '../types';

export interface WordPlan {
  cefr: string;
  count: number;
  cardFriendly: boolean;
}

export const WORDS_BY_PART: Record<string, WordPlan> = {
  starters_part1: { cefr: 'pre_a1', count: 4, cardFriendly: false },
  starters_part3: { cefr: 'pre_a1', count: 4, cardFriendly: true },
  movers_part1: { cefr: 'a1', count: 4, cardFriendly: false },
  movers_part3: { cefr: 'a1', count: 3, cardFriendly: false },
};

interface VocabRow {
  word: string;
  category: string;
}

function hash(text: string): number {
  let value = 7;
  for (const char of text) value = (value * 31 + char.charCodeAt(0)) % 1_000_003;
  return value;
}

function pick(rows: VocabRow[], count: number, seed: string, used: Set<string>): VocabRow[] {
  const fresh = rows.filter((row) => !used.has(row.word));
  const pool = (fresh.length >= count ? fresh : rows).sort((a, b) => hash(`${seed}${a.word}`) - hash(`${seed}${b.word}`));
  const picked: VocabRow[] = [];
  const categories = new Set<string>();
  for (const row of pool) {
    if (picked.length === count) break;
    if (categories.has(row.category)) continue;
    picked.push(row);
    categories.add(row.category);
  }
  for (const row of pool) {
    if (picked.length === count) break;
    if (!picked.includes(row)) picked.push(row);
  }
  return picked;
}

/**
 * @param prompt generation prompt with WORD_n and AVOID_LIST placeholders
 * @param ctx slot context carrying the database client
 * @param plan how many words and from which level
 * @returns the prompt with distinct vocabulary words of the level substituted
 */
export async function vocabularyMessage(prompt: string, ctx: SlotContext, plan: WordPlan): Promise<string> {
  let query = ctx.db
    .from('vocabulary')
    .select('word, category')
    .eq('framework', 'cambridge')
    .eq('cefr_level', plan.cefr)
    .eq('pointable', true);
  if (plan.cardFriendly) query = query.eq('object_card_friendly', true);
  const { data, error } = await query;
  if (error || !data || data.length === 0) throw new Error(`Vocabulary empty for ${plan.cefr}: ${error?.message ?? 'no rows'}`);
  const used = new Set(ctx.existing.flatMap((label) => label.split(/,\s*/)));
  const words = pick(data as VocabRow[], plan.count, ctx.variant, used);
  const withWords = words.reduce((text, row, index) => text.replaceAll(`{WORD_${index + 1}}`, row.word), prompt);
  const avoid = ctx.existing.length > 0 ? ctx.existing.map((label) => `- ${label}`).join('\n') : '(none yet, feel free to pick any topic)';
  return `${withWords.replaceAll('{AVOID_LIST}', avoid)}\n\nReturn the JSON only.`;
}
