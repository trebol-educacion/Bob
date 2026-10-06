export const PRACTICE_SUMMARY_KIND = 'practice_summary';

const PRACTICE_SCORE_MAX = 100;

/**
 * @param scores - per-turn scores on a 0-100 scale
 * @returns final evaluation payload; carries a graded average only when scores exist
 */
export function buildPracticeSummary(scores: number[]): Record<string, unknown> {
  const valid = scores.filter((score) => Number.isFinite(score));
  if (valid.length === 0) return { kind: PRACTICE_SUMMARY_KIND, count: 0 };
  const average = valid.reduce((sum, score) => sum + score, 0) / valid.length;
  return {
    kind: PRACTICE_SUMMARY_KIND,
    count: valid.length,
    score: Math.round(average * 10) / 10,
    score_max: PRACTICE_SCORE_MAX,
  };
}

/**
 * @param content - stored message content_json
 * @returns true when the payload is the closing summary of a free-practice session
 */
export function isPracticeSummary(content: unknown): boolean {
  return typeof content === 'object' && content !== null && (content as { kind?: unknown }).kind === PRACTICE_SUMMARY_KIND;
}
