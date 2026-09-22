import type { CefrLevel } from '@/lib/types/practice';

export type EffectiveLevelSource = 'skill' | 'tenant' | 'none';

export interface EffectiveLevelResult {
  level: CefrLevel | null;
  source: EffectiveLevelSource;
}
