import 'server-only';

import { createSupabaseServer } from '@/lib/supabase/server';
import { pickContent } from '@/lib/item-bank/content-source';
import { fail, ok, type ActionResult } from '@/lib/result';
import { toPublicGroup, toPublicItem } from '@/lib/item-bank/public';
import { parsePlacementConfig } from '@/lib/placement/config';
import type { PlacementConfig, PlacementLevel } from '@/lib/placement/types';
import type { PublicBankItem, PublicItemGroup } from '@/lib/item-bank/types';

export type PlacementSupabase = Awaited<ReturnType<typeof createSupabaseServer>>;
export type PlacementSkill = 'reading' | 'listening';

export interface StoredPlacementOutcome {
  level: PlacementLevel;
  correct: number;
  total: number;
  groupId: string;
}

export interface StoredPlacementState {
  outcomes: StoredPlacementOutcome[];
}

export interface PlacementStepContent {
  group: PublicItemGroup;
  items: PublicBankItem[];
}

/**
 * @param raw unknown
 * @returns StoredPlacementState
 */
export function parseStoredPlacementState(raw: unknown): StoredPlacementState {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as StoredPlacementState).outcomes)) {
    return { outcomes: [] };
  }
  return raw as StoredPlacementState;
}

/**
 * @param supabase PlacementSupabase
 * @returns Promise<PlacementConfig>
 */
export async function resolvePlacementConfig(supabase: PlacementSupabase): Promise<PlacementConfig> {
  const { data } = await supabase
    .from('test_configs')
    .select('config')
    .eq('code', 'placement_sequential_v1')
    .maybeSingle();

  return parsePlacementConfig((data?.config as Record<string, unknown> | undefined) ?? null);
}

/**
 * @param skill PlacementSkill
 * @param level PlacementLevel
 * @param excludeGroupIds string[]
 * @returns Promise<ActionResult<PlacementStepContent>>
 */
export async function fetchStepContent(
  skill: PlacementSkill,
  level: PlacementLevel,
  excludeGroupIds: string[]
): Promise<ActionResult<PlacementStepContent>> {
  const picked = await pickContent({
    framework: 'cefr',
    cefr: level,
    examPart: `placement_${skill}`,
    purpose: 'placement',
    skill,
    groupsOnly: true,
    excludeGroupIds,
  });
  if (!picked.ok) {
    console.error(`[placement] no content skill=${skill} level=${level} code=${picked.code}`);
    return picked;
  }
  if (picked.data.kind !== 'group') return fail('no_content');
  return ok({ group: toPublicGroup(picked.data.group), items: picked.data.items.map(toPublicItem) });
}
