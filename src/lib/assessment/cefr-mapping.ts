import type { AssessmentCefrBand, AssessmentConfidence } from '@/lib/types/skills';

export const LISTENING_CEFR_CUTOFF: ReadonlyArray<{
  band: AssessmentCefrBand;
  min: number;
  max: number;
}> = [
  { band: 'pre_a1', min: 0, max: 2 },
  { band: 'a1',     min: 3, max: 4 },
  { band: 'a2',     min: 5, max: 6 },
  { band: 'b1',     min: 7, max: 8 },
  { band: 'b2',     min: 9, max: 10 },
] as const;

/**
 * Maps a raw listening score to a CEFR band and confidence level.
 * Normalizes score to a scale of 10 before applying the cutoff table.
 */
export function mapListeningScoreToCefr(
  correct: number,
  total: number
): { band: AssessmentCefrBand; confidence: AssessmentConfidence } {
  const normalized = total > 0 ? Math.round((correct / total) * 10) : 0;

  const entry =
    LISTENING_CEFR_CUTOFF.find(e => normalized >= e.min && normalized <= e.max) ??
    LISTENING_CEFR_CUTOFF[0];

  const confidence: AssessmentConfidence =
    normalized > entry.min && normalized < entry.max
      ? 'high'
      : normalized === entry.min
      ? 'low'
      : 'medium';

  return { band: entry.band, confidence };
}
