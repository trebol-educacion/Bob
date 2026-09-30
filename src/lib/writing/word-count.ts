/**
 * @param text student text
 * @returns number of whitespace separated words
 */
export function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}
