import { resolveEffectiveLevel } from '@/lib/levels/effective-level';
import type { CefrLevel } from '@/lib/types/practice';
import type { SkillLevelMap } from '@/lib/types/skills';

export const DEFAULT_PRACTICE_LEVEL: CefrLevel = 'b1';

/**
 * @param skillLevels - per-skill levels of the student
 * @param cefrActiveLevel - level fixed by the tenant, when locked
 * @returns effective speaking level, defaulting when none is known
 */
export function resolvePracticeLevel(skillLevels: SkillLevelMap | null, cefrActiveLevel: CefrLevel | null): CefrLevel {
  return resolveEffectiveLevel(skillLevels, cefrActiveLevel, 'speaking').level ?? DEFAULT_PRACTICE_LEVEL;
}
