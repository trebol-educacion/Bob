import type { CardVisibility, DynamicCard, ModeFramework, ModeKey, ResolvedCard } from './types/practice';
import type { Skill, SkillLevelMap } from './types/skills';

export interface ResolveModesArgs {
  isBobEnabled: boolean;
  selectedSkill: Skill;
  skillLevels: SkillLevelMap;
  studentFrameworks: ModeFramework[];
  orgFrameworks: ModeFramework[];
  allDynamicCards: DynamicCard[];
}

/**
 * Returns resolved cards for the selected skill with visibility per card.
 *
 * Visibility rules (spec bob-skill-first-assessment §4, D3):
 *   - `enabled`                — framework + CEFR level match the student's level for selectedSkill.
 *   - `disabled-mismatch`      — framework matches but CEFR level differs from the student's level.
 *   - `disabled-not-available` — card is marked status='coming_soon' or 'hidden', or skill has
 *                                no level assigned in skillLevels.
 *
 * Cards whose framework is not in the effective intersection are excluded entirely.
 * Generic cards follow the same level-match logic unless cefr_level is null (universal).
 */
export function resolveEnabledModes({
  isBobEnabled,
  selectedSkill,
  skillLevels,
  studentFrameworks,
  orgFrameworks,
  allDynamicCards,
}: ResolveModesArgs): ResolvedCard[] {
  if (!isBobEnabled) return [];

  const effectiveFrameworks = studentFrameworks.filter(f => orgFrameworks.includes(f));
  const hasAssignedFrameworks = effectiveFrameworks.length > 0;

  const studentLevel = skillLevels[selectedSkill]?.cefr_level ?? null;

  const resolved: ResolvedCard[] = [];

  for (const card of allDynamicCards) {
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

      if (hasAssignedFrameworks) continue;

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

    if (!(effectiveFrameworks as string[]).includes(card.framework)) continue;

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

/**
 * Generic mode keys that remain visible even when the student has Cambridge / TOEFL
 * frameworks assigned. These cards render inside the framework section via the
 * override in mode-ui.ts (Phrase Practice inside PET / FCE).
 */
const GENERIC_ALWAYS_VISIBLE_WITH_FRAMEWORK = new Set<string>([
  'generic_situation|b1',
  'generic_situation|b2',
]);
