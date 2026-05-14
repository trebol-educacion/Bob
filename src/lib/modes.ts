import { CefrLevel, MODE_CATALOG, ModeFramework, ModeKey } from './types/practice';

export interface ResolveModesArgs {
  isBobEnabled: boolean;
  /** Single active CEFR level. null means the student has not yet selected a level. */
  studentActiveCefr: CefrLevel | null;
  /** Frameworks the student's org has granted (e.g. ['cambridge', 'toefl']). */
  studentFrameworks: ModeFramework[];
  /** Frameworks enabled at the org level. */
  orgFrameworks: ModeFramework[];
}

/**
 * Returns the list of ModeKeys the student can access.
 *
 * Inclusion rules (per spec Domain 4):
 *   1. Mode M is included iff `isBobEnabled` AND one of:
 *      a. M.framework === 'generic'
 *         AND (M.cefrLevels is empty  ← always-visible generic modes
 *              OR M.cefrLevels includes studentActiveCefr)
 *      b. M.framework ∈ (studentFrameworks ∩ orgFrameworks)
 *         AND M.cefrLevels includes studentActiveCefr
 *
 *   2. studentActiveCefr === null → only generic modes whose cefrLevels=[].
 */
export function resolveEnabledModes({
  isBobEnabled,
  studentActiveCefr,
  studentFrameworks,
  orgFrameworks,
}: ResolveModesArgs): ModeKey[] {
  if (!isBobEnabled) return [];

  const effectiveFrameworks = studentFrameworks.filter(f => orgFrameworks.includes(f));

  return (Object.keys(MODE_CATALOG) as ModeKey[]).filter(key => {
    const def = MODE_CATALOG[key];

    if (def.framework === 'generic') {
      // Always-visible generic modes (cefrLevels=[]) OR level-specific generic modes
      if (def.cefrLevels.length === 0) return true;
      if (studentActiveCefr === null) return false;
      return def.cefrLevels.includes(studentActiveCefr);
    }

    // Non-generic: requires matching framework AND active CEFR level
    if (studentActiveCefr === null) return false;
    if (!effectiveFrameworks.includes(def.framework)) return false;
    return def.cefrLevels.includes(studentActiveCefr);
  });
}
