export type ScoreHeadlineTier = 'excellent' | 'good' | 'fair' | 'keepGoing';

/**
 * @param score10 nota 0-10
 * @returns tramo del encabezado
 */
export function scoreHeadlineTier(score10: number): ScoreHeadlineTier {
  if (score10 >= 8) return 'excellent';
  if (score10 >= 6) return 'good';
  if (score10 >= 4) return 'fair';
  return 'keepGoing';
}
