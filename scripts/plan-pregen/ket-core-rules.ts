import { optionIssues } from './rules';

const MAX_PER_KEY = 3;

/**
 * @param keys answer keys in item order
 * @param label name of the keys for the message
 * @returns issues when one key is the answer more than three times or all keys are the same
 */
export function spreadIssues(keys: string[], label: string): string[] {
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  const issues: string[] = [];
  for (const [key, count] of counts) {
    if (count > MAX_PER_KEY) issues.push(`${label}: key ${key} is the answer ${count} times, use at most ${MAX_PER_KEY}`);
  }
  if (counts.size < 2) issues.push(`${label}: all keys are the same`);
  return issues;
}

/**
 * @param numbers item numbers in order
 * @param count expected number of items
 * @returns issues when the numbers are not 1..count in order
 */
export function numberingIssues(numbers: number[], count: number): string[] {
  if (numbers.length !== count) return [`expected ${count} items, got ${numbers.length}`];
  return numbers.flatMap((n, i) => (n === i + 1 ? [] : [`item ${i + 1}: number must be ${i + 1}`]));
}

/**
 * @param options A, B and C texts of one item
 * @param label item label
 * @returns issues when options repeat or are empty
 */
export function letterOptionIssues(options: { A: string; B: string; C: string }, label: string): string[] {
  return optionIssues([options.A, options.B, options.C], label);
}

/**
 * @param options A, B and C texts
 * @returns options in the shape the judge prompts expect
 */
export function judgeOptions(options: { A: string; B: string; C: string }): { key: string; label: string }[] {
  return [
    { key: 'A', label: options.A },
    { key: 'B', label: options.B },
    { key: 'C', label: options.C },
  ];
}
