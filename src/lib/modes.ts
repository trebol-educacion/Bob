import type { CardVisibility, DynamicCard, ModeFramework, ResolvedCard } from './types/practice';
import type { Skill, SkillLevelMap } from './types/skills';

export type PracticeTrack = 'official' | 'free';

export interface ResolveModesArgs {
  isBobEnabled: boolean;
  selectedSkill: Skill;
  skillLevels: SkillLevelMap;
  orgFrameworks: ModeFramework[];
  allDynamicCards: DynamicCard[];
  track?: PracticeTrack;
}

export function resolveEnabledModes({
  isBobEnabled,
  selectedSkill,
  skillLevels,
  orgFrameworks,
  allDynamicCards,
  track = 'official',
}: ResolveModesArgs): ResolvedCard[] {
  if (!isBobEnabled) return [];

  const hasAssignedFrameworks = orgFrameworks.length > 0;

  const studentLevel = skillLevels[selectedSkill]?.cefr_level ?? null;

  const resolved: ResolvedCard[] = [];

  for (const card of allDynamicCards) {
    if (card.skill !== selectedSkill) continue;
    if (card.status === 'hidden') continue;

    if (card.framework === 'generic') {
      const levelKey = `${card.mode_key}|${card.cefr_level ?? ''}`;

      if (GENERIC_ALWAYS_VISIBLE_WITH_FRAMEWORK.has(levelKey)) {
        if (studentLevel === null) continue;
        const vis: CardVisibility = card.cefr_level === studentLevel ? 'enabled' : 'disabled-mismatch';
        resolved.push({
          ...card,
          visibility: vis,
          reason: vis === 'enabled' ? 'level_match' : 'level_mismatch',
        });
        continue;
      }

      if (track === 'official' && hasAssignedFrameworks) continue;

      if (card.cefr_level === null) {
        resolved.push({ ...card, visibility: 'enabled', reason: 'level_match' });
        continue;
      }

      if (studentLevel === null) continue;
      const vis: CardVisibility = card.cefr_level === studentLevel ? 'enabled' : 'disabled-mismatch';
      resolved.push({
        ...card,
        visibility: vis,
        reason: vis === 'enabled' ? 'level_match' : 'level_mismatch',
      });
      continue;
    }

    if (!(orgFrameworks as string[]).includes(card.framework)) continue;

    if (card.status === 'coming_soon') {
      resolved.push({ ...card, visibility: 'disabled-not-available', reason: 'status_not_available' });
      continue;
    }

    if (studentLevel === null) {
      resolved.push({ ...card, visibility: 'disabled-not-available', reason: 'status_not_available' });
      continue;
    }

    const vis: CardVisibility = card.cefr_level === studentLevel ? 'enabled' : 'disabled-mismatch';
    resolved.push({
      ...card,
      visibility: vis,
      reason: vis === 'enabled' ? 'level_match' : 'level_mismatch',
    });
  }

  return resolved;
}

const GENERIC_ALWAYS_VISIBLE_WITH_FRAMEWORK = new Set<string>([
  'generic_situation|b1',
  'generic_situation|b2',
]);
