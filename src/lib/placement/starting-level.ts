import type { PlacementLevel } from './types';

export type StageToLevelTable = Readonly<Record<string, PlacementLevel>>;

export const DEFAULT_PLACEMENT_STARTING_LEVEL: PlacementLevel = 'a2';

/**
 * @param stage string
 * @param table StageToLevelTable
 * @param fallback PlacementLevel
 * @returns PlacementLevel
 */
export function resolveStartingLevel(
  stage: string | null,
  table: StageToLevelTable,
  fallback: PlacementLevel = DEFAULT_PLACEMENT_STARTING_LEVEL
): PlacementLevel {
  if (!stage) return fallback;
  return table[stage] ?? fallback;
}
