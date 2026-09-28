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
 * @deprecated Solo para el flujo de assessment por porcentaje (fallback de src/actions/placement/start.ts cuando no hay item_groups curados). El placement secuencial (T10.4, src/lib/placement/engine.ts) no usa corte por porcentaje global: corta por grupo (60%, src/lib/item-bank/scoring.ts) y por nivel (dos fallos, Q4).
 * @param correct number
 * @param total number
 * @returns { band: AssessmentCefrBand; confidence: AssessmentConfidence }
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
