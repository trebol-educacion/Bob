import type { KetOpenClozePlan } from '@/lib/bank-plans/ket-reading-part5';

export interface OpenClozeGapResult {
  number: number;
  given: string;
  expected: string;
  is_correct: boolean;
}

/**
 * @param word raw answer
 * @returns lowercase word without surrounding spaces or punctuation
 */
export function normalizeWord(word: string): string {
  return word.trim().toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, '').replace(/\s+/g, ' ');
}

/**
 * @param plan full plan with keys
 * @param answers word written per gap number
 * @returns per-gap result, accepting the key and its listed variants
 */
export function gradeOpenCloze(plan: KetOpenClozePlan, answers: Record<number, string>): OpenClozeGapResult[] {
  return plan.gaps.map((gap) => {
    const given = (answers[gap.number] ?? '').trim();
    const valid = [gap.answer, ...gap.accepted].map(normalizeWord);
    return { number: gap.number, given, expected: gap.answer, is_correct: given !== '' && valid.includes(normalizeWord(given)) };
  });
}
