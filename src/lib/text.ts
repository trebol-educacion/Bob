/**
 * Replaces typographic dashes (em, en, horizontal bar) used as sentence
 * punctuation with a comma, so LLM-generated copy reads cleanly for young
 * learners. ASCII hyphens inside words (well-known, A2) are left untouched.
 */
export function stripDashes(text: string): string {
  return text
    .replace(/\s*[—–―]\s*/g, ', ')
    .replace(/\s*,\s*,/g, ', ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}
