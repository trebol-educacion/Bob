import type { PlacementConfig } from './types';
import { PLACEMENT_LEVELS } from './types';

export const DEFAULT_PLACEMENT_CONFIG: PlacementConfig = {
  levels: PLACEMENT_LEVELS,
  groupsPerLevel: 2,
  passThreshold: 0.6,
  failsToStop: 2,
};

export const DEFAULT_PLACEMENT_COOLDOWN_DAYS = 7;

/**
 * @param raw Record<string, unknown>
 * @returns PlacementConfig
 */
export function parsePlacementConfig(raw: Record<string, unknown> | null | undefined): PlacementConfig {
  if (!raw) return DEFAULT_PLACEMENT_CONFIG;

  const levels = Array.isArray(raw.levels) && raw.levels.every((level) => typeof level === 'string')
    ? (raw.levels as PlacementConfig['levels'])
    : DEFAULT_PLACEMENT_CONFIG.levels;
  const groupsPerLevel = typeof raw.groupsPerLevel === 'number' ? raw.groupsPerLevel : DEFAULT_PLACEMENT_CONFIG.groupsPerLevel;
  const passThreshold = typeof raw.passThreshold === 'number' ? raw.passThreshold : DEFAULT_PLACEMENT_CONFIG.passThreshold;
  const failsToStop = typeof raw.failsToStop === 'number' ? raw.failsToStop : DEFAULT_PLACEMENT_CONFIG.failsToStop;

  return { levels, groupsPerLevel, passThreshold, failsToStop };
}

/**
 * @param raw Record<string, unknown>
 * @returns number
 */
export function parsePlacementCooldownDays(raw: Record<string, unknown> | null | undefined): number {
  if (!raw || typeof raw.cooldownDays !== 'number') return DEFAULT_PLACEMENT_COOLDOWN_DAYS;
  return raw.cooldownDays;
}
