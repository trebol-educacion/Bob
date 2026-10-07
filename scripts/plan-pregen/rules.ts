const MAX_SHARE = 0.4;
const MIN_ITEMS = 4;

/**
 * @param keys answer keys in item order
 * @param optionCount number of options per item
 * @param label name of the part for the message
 * @returns issues when one key concentrates more than 40 percent of the answers or an option is never the key
 */
export function keyDistributionIssues(keys: string[], optionCount: number, label: string): string[] {
  if (keys.length < MIN_ITEMS) return [];
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  const ceiling = Math.max(Math.ceil(keys.length / optionCount), Math.floor(keys.length * MAX_SHARE));
  const issues: string[] = [];
  for (const [key, count] of counts) {
    if (count > ceiling) issues.push(`${label}: key ${key} is the answer ${count} of ${keys.length} times, spread the keys more evenly`);
  }
  return issues;
}

/**
 * @param values strings that must differ from each other
 * @param label what the strings are
 * @returns issues listing duplicated values, ignoring case and punctuation
 */
export function duplicateIssues(values: string[], label: string): string[] {
  const seen = new Set<string>();
  const issues: string[] = [];
  for (const value of values) {
    const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (seen.has(normalized)) issues.push(`${label}: "${value}" is repeated`);
    seen.add(normalized);
  }
  return issues;
}

/**
 * @param text
 * @returns number of words
 */
export function wordsIn(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * @param text
 * @param min
 * @param max
 * @param label
 * @returns issue when the word count is outside the range
 */
export function wordRangeIssues(text: string, min: number, max: number, label: string): string[] {
  const words = wordsIn(text);
  return words >= min && words <= max ? [] : [`${label}: ${words} words, expected ${min}-${max}`];
}

/**
 * @param values option texts
 * @param label
 * @returns issues when an option is empty or two options are identical
 */
export function optionIssues(values: string[], label: string): string[] {
  const issues = duplicateIssues(values, `${label} options`);
  if (values.some((value) => value.trim().length === 0)) issues.push(`${label}: empty option`);
  return issues;
}
