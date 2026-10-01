/**
 * @param value
 * @returns lowercased, trimmed, whitespace-collapsed, accent-free text
 */
export function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * @param input
 * @param accepted
 * @returns true when input equals any accepted answer after normalisation
 */
export function isAcceptedAnswer(input: string, accepted: readonly string[]): boolean {
  const candidate = normalizeAnswer(input);
  if (candidate === '') return false;
  return accepted.some((answer) => normalizeAnswer(answer) === candidate);
}
