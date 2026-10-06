export type WordStatus = 'short' | 'ok' | 'long';

/**
 * @param wordCount words written
 * @param minWords minimum to submit
 * @param maxWords upper limit before warning
 * @returns WordStatus
 */
export function wordStatus(wordCount: number, minWords: number, maxWords: number): WordStatus {
  if (wordCount < minWords) return 'short';
  if (wordCount > maxWords) return 'long';
  return 'ok';
}
