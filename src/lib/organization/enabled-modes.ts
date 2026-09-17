import type { CefrLevel, DynamicCard, ModeFramework, ModeKey } from '@/lib/types/practice';

const GENERIC_ALWAYS_VISIBLE = new Set(['generic_situation|b1', 'generic_situation|b2']);

export interface EnabledModesParams {
  isBobEnabled: boolean;
  cards: DynamicCard[];
  activeLevel: CefrLevel | null;
  effectiveFrameworks: ModeFramework[];
  hasAssignedFrameworks: boolean;
}

export function computeEnabledModes({
  isBobEnabled,
  cards,
  activeLevel,
  effectiveFrameworks,
  hasAssignedFrameworks,
}: EnabledModesParams): ModeKey[] {
  if (!isBobEnabled) return [];
  return cards
    .filter(card => {
      if (card.framework === 'generic') {
        const lk = `${card.mode_key}|${card.cefr_level ?? ''}`;
        if (GENERIC_ALWAYS_VISIBLE.has(lk)) {
          return activeLevel !== null && card.cefr_level === activeLevel;
        }
        if (hasAssignedFrameworks) return false;
        if (card.cefr_level === null) return true;
        return activeLevel !== null && card.cefr_level === activeLevel;
      }
      if (activeLevel === null) return false;
      if (!(effectiveFrameworks as string[]).includes(card.framework)) return false;
      return card.cefr_level === activeLevel;
    })
    .map(card => card.mode_key);
}
