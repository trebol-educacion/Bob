import type { Skill, SkillLevelMap } from '@/lib/types/skills';
import type { LevelPolicyInput, LevelPolicyResult } from './types';

/**
 * @param input LevelPolicyInput
 * @returns LevelPolicyResult
 */
export function resolveLevelPolicy(input: LevelPolicyInput): LevelPolicyResult {
  const skipPlacement = input.cefrLevelLocked && input.cefrActiveLevel !== null;
  return {
    skipPlacement,
    allowManualSelection: input.testerOverrideEnabled,
  };
}

/**
 * @param envValue string
 * @returns boolean
 */
export function isLevelSelectorTesterEnabled(envValue: string | undefined): boolean {
  return envValue === 'true';
}

/**
 * @param skillLevels SkillLevelMap
 * @param skill Skill
 * @returns boolean
 */
export function mustTakePlacement(skillLevels: SkillLevelMap | null, skill: Skill): boolean {
  return !skillLevels?.[skill];
}
