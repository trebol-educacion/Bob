import type { BankItem, ItemGroup } from '@/lib/item-bank/types';

export type ClozeOptionId = 'A' | 'B' | 'C' | 'D';

export interface ClozeOption {
  id: ClozeOptionId;
  text: string;
}

export interface ClozeGap {
  number: number;
  options: ClozeOption[];
}

export interface ClozePlan {
  groupId: string;
  title: string;
  text_with_gaps: string;
  gaps: ClozeGap[];
}

export interface ClozeGapResult {
  number: number;
  chosen: ClozeOptionId;
  correct_option: ClozeOptionId;
  isCorrect: boolean;
  explanation: string;
}

const OPTION_IDS: readonly string[] = ['A', 'B', 'C', 'D'];

function isOptionId(value: string): value is ClozeOptionId {
  return OPTION_IDS.includes(value);
}

function numberOf(item: BankItem, index: number): number {
  const value = Number(item.metadata?.number);
  return Number.isFinite(value) && value > 0 ? value : index + 1;
}

function ordered(items: BankItem[]): BankItem[] {
  return [...items].sort((a, b) => (a.group_order ?? 0) - (b.group_order ?? 0));
}

/**
 * @param group published cloze group
 * @param items its items
 * @returns public plan without keys or explanations
 */
export function toClozePlan(group: ItemGroup, items: BankItem[]): ClozePlan {
  const title = typeof group.metadata.title === 'string' ? group.metadata.title : '';
  return {
    groupId: group.id,
    title,
    text_with_gaps: group.stimulus_text ?? '',
    gaps: ordered(items).map((item, index) => ({
      number: numberOf(item, index),
      options: item.options
        .filter((o): o is { key: ClozeOptionId; label: string } => isOptionId(o.key))
        .map((o) => ({ id: o.key, text: o.label })),
    })),
  };
}

/**
 * @param items bank items of the group
 * @param answers chosen option per gap number
 * @returns per-gap result computed from the stored keys
 */
export function gradeCloze(items: BankItem[], answers: Record<number, ClozeOptionId>): ClozeGapResult[] {
  return ordered(items).map((item, index) => {
    const number = numberOf(item, index);
    const correct = isOptionId(item.correct_key) ? item.correct_key : 'A';
    const chosen = answers[number] ?? 'A';
    return {
      number,
      chosen,
      correct_option: correct,
      isCorrect: chosen === correct,
      explanation: item.explanation ?? '',
    };
  });
}
