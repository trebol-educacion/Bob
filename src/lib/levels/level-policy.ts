import type { Skill, SkillLevelMap } from '@/lib/types/skills';
import { inferSkillFromMode, inferModeMetadata } from '@/lib/skill-from-mode';
import type { LevelPolicyInput, LevelPolicyResult } from './types';

const PLACEMENT_GATED_CEFR_LEVELS = new Set(['a2', 'b1', 'b2']);
const PLACEMENT_GATED_MODE_PREFIXES = ['cambridge_', 'toefl_'];
const PLACEMENT_EXEMPT_MODE_PREFIXES = ['assessment_', 'placement_'];

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

/**
 * @param mode string
 * @returns Skill
 */
export function requiresPlacementGate(mode: string): Skill | null {
  if (PLACEMENT_EXEMPT_MODE_PREFIXES.some((prefix) => mode.startsWith(prefix))) return null;
  if (!PLACEMENT_GATED_MODE_PREFIXES.some((prefix) => mode.startsWith(prefix))) return null;

  const { cefr_level } = inferModeMetadata(mode);
  if (!cefr_level || !PLACEMENT_GATED_CEFR_LEVELS.has(cefr_level)) return null;

  return inferSkillFromMode(mode);
}
