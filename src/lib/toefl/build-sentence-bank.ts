import type { ToeflBuildSentencePlan } from '@/lib/bank-plans/toefl-build-sentence';
import type { ClosedEntry } from '@/lib/toefl/closed-set';

export interface BuildSentenceBankItem {
  id: string;
  prompt: string;
  tokens: string[];
  target_sentence: string;
}

const PROMPT = 'Rearrange the words to form a correct sentence.';

/**
 * @param plan - stored build-a-sentence set
 * @param groupId - bank group the set came from
 * @returns items shaped for the build-a-sentence UI with stable ids per group
 */
export function toBuildSentenceItems(plan: ToeflBuildSentencePlan, groupId: string): BuildSentenceBankItem[] {
  return plan.items.map((item, index) => ({
    id: `${groupId}-${index + 1}`,
    prompt: PROMPT,
    tokens: item.tokens,
    target_sentence: item.correct_sentence,
  }));
}

/**
 * @param items - build-a-sentence items rebuilt from the stored plan
 * @param entries - answers sent by the client
 * @returns one entry per stored item, matched against the stored sentence
 */
export function sentenceEntriesFromBank(items: BuildSentenceBankItem[], entries: ClosedEntry[]): ClosedEntry[] {
  const selectedById = new Map(entries.map((entry) => [entry.id, entry.selected]));
  return items.map((item) => ({
    id: item.id,
    selected: selectedById.get(item.id) ?? '',
    expected: item.target_sentence,
    match: 'sentence',
  }));
}
