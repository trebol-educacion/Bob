import type { CefrLevel } from '@/lib/types/practice';
import type { Skill, SkillLevelMap } from '@/lib/types/skills';
import type { EffectiveLevelResult } from './types';

/**
 * @param skillLevels SkillLevelMap
 * @param tenantLevel CefrLevel
 * @param skill Skill
 * @returns EffectiveLevelResult
 */
export function resolveEffectiveLevel(
  skillLevels: SkillLevelMap | null,
  tenantLevel: CefrLevel | null,
  skill: Skill | null
): EffectiveLevelResult {
  const skillLevel = skill ? skillLevels?.[skill]?.cefr_level : undefined;
  if (skillLevel) return { level: skillLevel, source: 'skill' };
  if (tenantLevel) return { level: tenantLevel, source: 'tenant' };
  return { level: null, source: 'none' };
}
