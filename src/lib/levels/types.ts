import type { CefrLevel } from '@/lib/types/practice';

export type EffectiveLevelSource = 'skill' | 'tenant' | 'none';

export interface EffectiveLevelResult {
  level: CefrLevel | null;
  source: EffectiveLevelSource;
  placementPending: boolean;
  locked: boolean;
}

export interface LevelPolicyInput {
  cefrLevelLocked: boolean;
  cefrActiveLevel: CefrLevel | null;
  testerOverrideEnabled: boolean;
}

export interface LevelPolicyResult {
  skipPlacement: boolean;
  allowManualSelection: boolean;
}
