import type { Payload, PayloadItem } from './schemas';

export interface ReviewContext {
  existingTitles: ReadonlySet<string>;
}

const MAX_SHARE = 0.4;
const MIN_ITEMS_FOR_DISTRIBUTION = 4;

const CONTRACTIONS: [string, string][] = [
  ['do not', "don't"],
  ['does not', "doesn't"],
  ['did not', "didn't"],
  ['is not', "isn't"],
  ['are not', "aren't"],
  ['was not', "wasn't"],
  ['were not', "weren't"],
  ['have not', "haven't"],
  ['has not', "hasn't"],
  ['had not', "hadn't"],
  ['will not', "won't"],
  ['would not', "wouldn't"],
  ['could not', "couldn't"],
  ['should not', "shouldn't"],
  ['must not', "mustn't"],
  ['cannot', "can't"],
  ['can not', 'cannot'],
];

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function numberOf(item: PayloadItem, index: number): number {
  const value = Number(item.metadata.number);
  return Number.isFinite(value) && value > 0 ? value : index + 1;
}

/**
 * @param title
 * @returns lowercase title without punctuation
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param payload
 * @param context titles already published for the part
 * @returns issues with the group title: duplicated across sets or repeated at the start of the text
 */
export function titleIssues(payload: Payload, context: ReviewContext): string[] {
  const title = str(payload.group?.metadata.title).trim();
  if (!title) return [];
  const normalized = normalizeTitle(title);
  const issues: string[] = [];
  if (context.existingTitles.has(normalized)) {
    issues.push(`title "${title}" is already used by another set; choose a different, unique title`);
  }
  const text = normalizeTitle(payload.group?.stimulus_text ?? '');
  if (text.startsWith(normalized)) {
    issues.push('stimulus_text starts with its own title; the title is shown separately, start the text with the first sentence');
  }
  return issues;
}

function optionCountOf(payload: Payload): number {
  const first = payload.items[0]?.options.length ?? 0;
  if (first > 0) return first;
  const shared = payload.group?.metadata.shared_options;
  return Array.isArray(shared) ? shared.length : 0;
}

/**
 * @param payload
 * @returns issues when one answer letter concentrates more than 40% of the keys
 */
export function distributionIssues(payload: Payload): string[] {
  const keys = payload.items.map((i) => i.correct_key);
  const total = keys.length;
  const optionCount = optionCountOf(payload);
  const letters = keys.every((k) => /^[A-H]$/.test(k));
  if (!letters || optionCount < 2 || total < MIN_ITEMS_FOR_DISTRIBUTION) return [];
  const distinctPart = new Set(keys).size === total;
  if (distinctPart) return [];
  const limit = Math.max(Math.floor(total * MAX_SHARE), Math.ceil(total / optionCount));
  const counts = new Map<string, number>();
  keys.forEach((k) => counts.set(k, (counts.get(k) ?? 0) + 1));
  return [...counts.entries()]
    .filter(([, count]) => count > limit)
    .map(([key, count]) => `correct_key "${key}" is used ${count} of ${total} times (maximum ${limit}); spread the answers over all letters`);
}

function lastWord(value: string): string {
  return value.trim().split(/\s+/).pop()?.toLowerCase() ?? '';
}

function firstWord(value: string): string {
  return value.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
}

function clean(word: string): string {
  return word.toLowerCase().replace(/[^a-z']/g, '');
}

/**
 * @param sentence second sentence with the gap written as ____
 * @param answers key and accepted answers
 * @returns issues when the words around the gap duplicate part of an answer
 */
export function gapNeighbourIssues(sentence: string, answers: string[]): string[] {
  const match = sentence.match(/_{3,}/);
  if (!match || match.index === undefined) return [];
  const before = sentence.slice(0, match.index).trim().split(/\s+/).map(clean).filter(Boolean);
  const after = sentence.slice(match.index + match[0].length).trim().split(/\s+/).map(clean).filter(Boolean);
  const issues: string[] = [];
  for (const answer of answers) {
    const last = clean(lastWord(answer));
    const first = clean(firstWord(answer));
    const next = after[0];
    const echo = last.length >= 5 ? after.find((w) => w !== last && w.startsWith(last) && w.length - last.length <= 3) : undefined;
    if (echo) issues.push(`"${answer}" ends in "${last}" but the sentence continues with "${echo}" after the gap, so the verb is repeated`);
    if (next && last.length >= 3 && next === last) issues.push(`"${answer}" repeats "${next}" which already follows the gap`);
    const previous = before[before.length - 1];
    if (previous && first.length >= 2 && previous === first) issues.push(`"${answer}" repeats "${previous}" which already precedes the gap`);
  }
  return [...new Set(issues)];
}

/**
 * @param payload key word transformation set
 * @returns issues per item caused by the text around the gap
 */
export function transformationIssues(payload: Payload): string[] {
  return payload.items.flatMap((item, index) => {
    const accepted = Array.isArray(item.metadata.accepted) ? (item.metadata.accepted as string[]) : [];
    const answers = [...new Set([item.correct_key, ...accepted])];
    return gapNeighbourIssues(str(item.metadata.second_sentence_with_gap), answers).map(
      (issue) => `item ${numberOf(item, index)}: ${issue}`,
    );
  });
}

/**
 * @param accepted accepted answers
 * @param maxWords longest allowed answer
 * @returns accepted plus contracted or expanded equivalents
 */
export function withContractionVariants(accepted: string[], maxWords: number): string[] {
  const result = new Set(accepted);
  for (const answer of accepted) {
    for (const [long, short] of CONTRACTIONS) {
      const expanded = answer.replace(new RegExp(`\\b${short}`, 'g'), long);
      const contracted = answer.replace(new RegExp(`\\b${long}\\b`, 'g'), short);
      for (const variant of [expanded, contracted]) {
        if (variant !== answer && variant.trim().split(/\s+/).length <= maxWords) result.add(variant);
      }
    }
  }
  return [...result];
}

/**
 * @param examPart
 * @param payload
 * @param context
 * @returns every deterministic issue of the set
 */
export function ruleIssues(examPart: string, payload: Payload, context: ReviewContext): string[] {
  return [
    ...(examPart === 'fce_reading_part4' ? [] : titleIssues(payload, context)),
    ...distributionIssues(payload),
    ...transformationIssues(payload),
  ];
}
