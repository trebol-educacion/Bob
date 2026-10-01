import type { BankItem } from '@/lib/item-bank/types';
import { isAcceptedAnswer, normalizeAnswer } from '@/lib/answer-match';
import { itemNumber } from './fce-grouped-public';
import {
  FCE_GROUPED_ANSWER_KIND,
  type FCEGroupedItemResult,
  type FCEGroupedPart,
  type FCEGroupedScore,
} from './fce-grouped-types';

const KEY_WORD_MIN_WORDS = 2;
const KEY_WORD_MAX_WORDS = 5;

function acceptedOf(item: BankItem): string[] {
  const listed = item.metadata?.accepted ?? [];
  return [item.correct_key, ...listed];
}

function keywordOf(item: BankItem): string {
  const raw = (item.metadata as Record<string, unknown> | null | undefined)?.keyword;
  return typeof raw === 'string' ? raw : '';
}

function countWords(value: string): number {
  const normalized = normalizeAnswer(value);
  return normalized === '' ? 0 : normalized.split(' ').length;
}

function containsKeyword(value: string, keyword: string): boolean {
  const target = normalizeAnswer(keyword);
  if (target === '') return true;
  return normalizeAnswer(value).split(' ').includes(target);
}

/**
 * @param part
 * @param item
 * @param given
 * @returns true when the given answer is correct for the item
 */
export function isItemCorrect(part: FCEGroupedPart, item: BankItem, given: string): boolean {
  const kind = FCE_GROUPED_ANSWER_KIND[part];
  if (kind === 'choice' || kind === 'sentence') {
    return given.trim().toUpperCase() === item.correct_key.trim().toUpperCase();
  }
  if (!isAcceptedAnswer(given, acceptedOf(item))) return false;
  if (kind !== 'key-word') return true;
  const words = countWords(given);
  return (
    words >= KEY_WORD_MIN_WORDS &&
    words <= KEY_WORD_MAX_WORDS &&
    containsKeyword(given, keywordOf(item))
  );
}

/**
 * @param correct
 * @param total
 * @returns mark on a 0-10 scale with one decimal
 */
export function toScore10(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100) / 10;
}

/**
 * @param part
 * @param items
 * @param answers
 * @returns per-item results and score
 */
export function gradeExercise(
  part: FCEGroupedPart,
  items: BankItem[],
  answers: Record<number, string>
): FCEGroupedScore & { results: FCEGroupedItemResult[] } {
  const results = items
    .map((item) => {
      const number = itemNumber(item);
      const given = answers[number] ?? '';
      return {
        number,
        given,
        expected: item.correct_key,
        isCorrect: isItemCorrect(part, item, given),
      };
    })
    .sort((a, b) => a.number - b.number);
  const correct = results.filter((r) => r.isCorrect).length;
  return { results, correct, total: results.length, score10: toScore10(correct, results.length) };
}
