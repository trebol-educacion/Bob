import type { SkillLevelMap } from '@/lib/types/skills';

/**
 * @param skillLevels SkillLevelMap | null
 * @returns boolean
 */
export function isBrandNewStudent(skillLevels: SkillLevelMap | null): boolean {
  return !skillLevels || Object.keys(skillLevels).length === 0;
}
