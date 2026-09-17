import type { CefrLevel } from '@/lib/types/practice';
import type { Skill, SkillLevelMap, SkillLevelOrigin } from '@/lib/types/skills';

const ALL_SKILLS: Skill[] = ['reading', 'listening', 'writing', 'speaking'];

export interface RawSkillLevelRow {
  skill: string;
  cefr_level: string;
  origin: string;
  confidence: number | null;
  last_assessment_at: string | null;
  updated_at: string;
}

export function mapSkillLevelRows(rows: RawSkillLevelRow[]): SkillLevelMap {
  const map: SkillLevelMap = {};
  for (const row of rows) {
    const skill = row.skill as Skill;
    if (ALL_SKILLS.includes(skill)) {
      map[skill] = {
        cefr_level: row.cefr_level as CefrLevel,
        origin: row.origin as SkillLevelOrigin,
        confidence: row.confidence,
        last_assessment_at: row.last_assessment_at,
        updated_at: row.updated_at,
      };
    }
  }
  return map;
}
