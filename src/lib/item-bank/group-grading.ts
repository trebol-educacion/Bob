import { isAcceptedAnswer } from '@/lib/answer-match';
import type { BankItem } from './types';
import type { GroupAnswers, GroupItemResult, GroupSubmitResult } from './group-types';

export type AnswerMatcher = (given: string, item: BankItem) => boolean;

export function scoreOutOfTen(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100) / 10;
}

export const matchesLetterKey: AnswerMatcher = (given, item) =>
  given.trim().toUpperCase() === item.correct_key.trim().toUpperCase();

export const matchesAcceptedText: AnswerMatcher = (given, item) =>
  isAcceptedAnswer(given, [item.correct_key, ...(item.metadata?.accepted ?? [])]);

export function gradeGroupAnswers(
  items: BankItem[],
  answers: GroupAnswers,
  matcher: AnswerMatcher,
): GroupSubmitResult {
  const results: GroupItemResult[] = items.map((item) => {
    const given = (answers[item.id] ?? '').trim();
    return {
      item_id: item.id,
      given,
      correct_key: item.correct_key,
      is_correct: given !== '' && matcher(given, item),
      explanation: item.explanation ?? null,
    };
  });
  const correct = results.filter((result) => result.is_correct).length;
  return { correct, total: items.length, score_10: scoreOutOfTen(correct, items.length), results };
}
