/**
 * Skill levels — shared type contracts.
 */

import type { SkillLevelMap } from '@/lib/types/skills';

export interface StudentSkillSummary {
  user_id: string;
  skills: SkillLevelMap;
}

