export const SCORE_THRESHOLDS = {
  EXCELLENT: 90,
  GOOD: 70,
} as const;

// Uses ONLY trebol-* tokens — consistent with ResultCard tokens
export function getScoreColor(score: number): string {
  if (score >= SCORE_THRESHOLDS.EXCELLENT) return 'text-trebol-primary';
  if (score >= SCORE_THRESHOLDS.GOOD) return 'text-trebol-secondary';
  return 'text-trebol-primary opacity-70';
}
