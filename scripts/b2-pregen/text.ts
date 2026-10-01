const GAP_MARKER = /___\d+___/g;

/**
 * @param text
 * @returns word count ignoring gap markers
 */
export function countWords(text: string): number {
  return text
    .replace(GAP_MARKER, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

/**
 * @param text
 * @returns gap numbers found, in order
 */
export function gapNumbers(text: string): number[] {
  return [...text.matchAll(/___(\d+)___/g)].map((m) => Number(m[1]));
}
