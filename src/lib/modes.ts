import { CefrLevel, MODE_CATALOG, ModeFramework, ModeKey } from './types/practice';

export interface ResolveModesArgs {
  isBobEnabled: boolean;
  studentCefrLevels: CefrLevel[];
  studentFrameworks: ModeFramework[];
  orgFrameworks: ModeFramework[];
}

export function resolveEnabledModes({
  isBobEnabled,
  studentCefrLevels,
  studentFrameworks,
  orgFrameworks,
}: ResolveModesArgs): ModeKey[] {
  if (!isBobEnabled) return [];

  const effectiveFrameworks = studentFrameworks.filter(f => orgFrameworks.includes(f));

  return (Object.keys(MODE_CATALOG) as ModeKey[]).filter(key => {
    const def = MODE_CATALOG[key];
    if (def.framework === 'generic') return true;
    if (!effectiveFrameworks.includes(def.framework)) return false;
    return def.cefrLevels.some(l => studentCefrLevels.includes(l));
  });
}
