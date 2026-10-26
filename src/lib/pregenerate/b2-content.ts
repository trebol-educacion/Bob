import { getCachedContentIfExists } from '@/lib/cache';
import type { CacheKey } from '@/lib/cache-keys';
import type { BobDbClient } from '@/lib/supabase/admin';
import { FCE_PART2_POOL_SIZE } from '@/lib/writing/fce-part2';
import {
  FCE_PART2_GENERATION_KEY,
  fcePart2CacheKey,
  getFcePart2Generation,
  isValidFcePart2Generation,
} from '@/lib/writing/fce-part2-generation';
import {
  isStoredScenario,
  collaborativeScenarioKey,
  loadCollaborativeScenario,
  scenarioVariants,
  type CollaborativeConfig,
} from '@/lib/speaking/collaborative';
import { FCE_COLLABORATIVE_CONFIG } from '@/lib/speaking/fce-configs';

export type PregenerateStatus = 'cached' | 'generated' | 'error';
export type PregenerateScope = 'writing' | 'speaking';

export interface PregenerateResult {
  key: string;
  variant: number;
  status: PregenerateStatus;
}

export interface PregenerateFilter {
  only?: PregenerateScope;
  config?: string;
  variant?: number;
}

interface PregenerateTarget {
  key: string;
  variant: number;
  scope: PregenerateScope;
  cacheKey: CacheKey;
  isValid: (value: unknown) => boolean;
  produce: (client: BobDbClient) => Promise<unknown | { error: string }>;
}

export const PREGENERATE_CONCURRENCY = 6;
export const PREGENERATED_COLLABORATIVE_CONFIGS: CollaborativeConfig[] = [FCE_COLLABORATIVE_CONFIG];

function writingTargets(): PregenerateTarget[] {
  return Array.from({ length: FCE_PART2_POOL_SIZE }, (_, variant) => ({
    key: FCE_PART2_GENERATION_KEY,
    variant,
    scope: 'writing' as const,
    cacheKey: fcePart2CacheKey(variant),
    isValid: (value) => isValidFcePart2Generation(value as Parameters<typeof isValidFcePart2Generation>[0]),
    produce: (client) => getFcePart2Generation(variant, { client }),
  }));
}

function speakingTargets(config: CollaborativeConfig): PregenerateTarget[] {
  return scenarioVariants(config).map((variant) => ({
    key: config.scenarioCacheKey,
    variant,
    scope: 'speaking' as const,
    cacheKey: collaborativeScenarioKey(config, variant),
    isValid: isStoredScenario,
    produce: (client) => loadCollaborativeScenario(config, { variant, client }),
  }));
}

/**
 * @param filter PregenerateFilter
 * @returns targets matching the filter
 */
export function selectPregenerateTargets(filter: PregenerateFilter = {}): PregenerateTarget[] {
  const writing = filter.only === 'speaking' ? [] : writingTargets();
  const speaking = filter.only === 'writing'
    ? []
    : PREGENERATED_COLLABORATIVE_CONFIGS
        .filter((config) => !filter.config || config.mode === filter.config || config.scenarioCacheKey === filter.config)
        .flatMap(speakingTargets);
  const targets = filter.config && filter.only !== 'writing' ? speaking : [...writing, ...speaking];
  return filter.variant === undefined ? targets : targets.filter((target) => target.variant === filter.variant);
}

async function runTarget(target: PregenerateTarget, client: BobDbClient): Promise<PregenerateResult> {
  const base = { key: target.key, variant: target.variant };
  const existing = await getCachedContentIfExists<unknown>(target.cacheKey, 'json', client);
  if (existing !== null && target.isValid(existing)) return { ...base, status: 'cached' };
  const produced = await target.produce(client);
  if (produced && typeof produced === 'object' && 'error' in produced) return { ...base, status: 'error' };
  return { ...base, status: target.isValid(produced) ? 'generated' : 'error' };
}

/**
 * @param targets PregenerateTarget[]
 * @param client BobDbClient
 * @returns one result per target, processed in chunks of PREGENERATE_CONCURRENCY
 */
export async function pregenerate(targets: PregenerateTarget[], client: BobDbClient): Promise<PregenerateResult[]> {
  const results: PregenerateResult[] = [];
  for (let index = 0; index < targets.length; index += PREGENERATE_CONCURRENCY) {
    const chunk = targets.slice(index, index + PREGENERATE_CONCURRENCY);
    results.push(...(await Promise.all(chunk.map((target) => runTarget(target, client)))));
  }
  return results;
}
