import type { CefrLevel } from '@/lib/types/practice';
import type { Skill, SkillLevelMap } from '@/lib/types/skills';
import type { PendingAssessmentsMap } from '@/actions/assessment/types';
import type { EffectiveLevelResult, LevelPolicyResult } from './types';

/**
 * @param skillLevels SkillLevelMap
 * @param tenantLevel CefrLevel
 * @param skill Skill
 * @param pendingAssessments PendingAssessmentsMap
 * @param levelPolicy LevelPolicyResult
 * @returns EffectiveLevelResult
 */
export function resolveEffectiveLevel(
  skillLevels: SkillLevelMap | null,
  tenantLevel: CefrLevel | null,
  skill: Skill | null,
  pendingAssessments: PendingAssessmentsMap | null = null,
  levelPolicy: LevelPolicyResult | null = null
): EffectiveLevelResult {
  const placementPending = Boolean(skill && pendingAssessments?.[skill]);
  const locked = Boolean(levelPolicy?.skipPlacement);
  const skillLevel = skill ? skillLevels?.[skill]?.cefr_level : undefined;
  if (skillLevel) return { level: skillLevel, source: 'skill', placementPending, locked };
  if (tenantLevel) return { level: tenantLevel, source: 'tenant', placementPending, locked };
  return { level: null, source: 'none', placementPending, locked };
}
