export type ScoreTier = 'perfect' | 'great' | 'good' | 'fair' | 'keep';

/**
 * @param score10 nota 0-10
 * @returns tramo único del titular de resultado
 */
export function scoreTier(score10: number): ScoreTier {
  if (score10 >= 10) return 'perfect';
  if (score10 >= 8) return 'great';
  if (score10 >= 6) return 'good';
  if (score10 >= 4) return 'fair';
  return 'keep';
}

/**
 * @param score aciertos o puntos
 * @param scoreMax máximo posible
 * @returns nota 0-10 redondeada a una décima
 */
export function toTenScale(score: number, scoreMax: number): number {
  if (!(scoreMax > 0)) return 0;
  return Math.round((score / scoreMax) * 100) / 10;
}
