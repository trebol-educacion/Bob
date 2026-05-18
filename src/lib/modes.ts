import type { CefrLevel, DynamicCard, ModeFramework, ModeKey } from './types/practice';

export interface ResolveModesArgs {
  isBobEnabled: boolean;
  /** Single active CEFR level. null means the student has not yet selected a level. */
  studentActiveCefr: CefrLevel | null;
  /** Frameworks the student's org has granted (e.g. ['cambridge', 'toefl']). */
  studentFrameworks: ModeFramework[];
  /** Frameworks enabled at the org level. */
  orgFrameworks: ModeFramework[];
  /**
   * Full catalog from bob_prompts (BD). Source of truth for what activities exist.
   * Replaces the previous static catalog iteration. See spec.md §2.2.
   */
  allDynamicCards: DynamicCard[];
}

/**
 * Returns the list of ModeKeys the student can access.
 *
 * Inclusion rules (per spec §2.2):
 *   1. Mode M is included iff `isBobEnabled` AND one of:
 *      a. M.framework === 'generic' (fallback, visible only when the student
 *         has NO framework assigned). Cards with `cefr_level === null` are
 *         universal; otherwise must match studentActiveCefr.
 *      b. M.framework ∈ (studentFrameworks ∩ orgFrameworks)
 *         AND M.cefr_level === studentActiveCefr
 *
 *   2. studentActiveCefr === null → only universal generics (`cefr_level=null`).
 */
export function resolveEnabledModes({
  isBobEnabled,
  studentActiveCefr,
  studentFrameworks,
  orgFrameworks,
  allDynamicCards,
}: ResolveModesArgs): ModeKey[] {
  if (!isBobEnabled) return [];

  const effectiveFrameworks = studentFrameworks.filter(f => orgFrameworks.includes(f));
  const hasAssignedFrameworks = effectiveFrameworks.length > 0;

  return allDynamicCards
    .filter(card => {
      if (card.framework === 'generic') {
        const levelKey = `${card.mode_key}|${card.cefr_level ?? ''}`;
        if (GENERIC_ALWAYS_VISIBLE_WITH_FRAMEWORK.has(levelKey)) {
          if (studentActiveCefr === null) return false;
          return card.cefr_level === studentActiveCefr;
        }
        if (hasAssignedFrameworks) return false;
        if (card.cefr_level === null) return true;
        if (studentActiveCefr === null) return false;
        return card.cefr_level === studentActiveCefr;
      }
      if (studentActiveCefr === null) return false;
      if (!(effectiveFrameworks as string[]).includes(card.framework)) return false;
      return card.cefr_level === studentActiveCefr;
    })
    .map(card => card.mode_key);
}

/**
 * Generic mode keys that should remain visible even when the student has
 * Cambridge / TOEFL frameworks assigned. These cards render inside the
 * framework section via the override in mode-ui.ts (Phrase Practice ends
 * up inside PET / FCE), so excluding them as "generic fallback only"
 * leaves the student without the activity.
 */
const GENERIC_ALWAYS_VISIBLE_WITH_FRAMEWORK = new Set<string>([
  'generic_situation|b1',
  'generic_situation|b2',
]);
