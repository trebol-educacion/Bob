import 'server-only';

import { createSupabaseServer } from '@/lib/supabase/server';
import { fetchGroups, fetchGroupItems } from '@/actions/item-bank/repository';
import { toPublicGroup, toPublicItem } from '@/lib/item-bank/public';
import { parsePlacementConfig, parsePlacementCooldownDays } from '@/lib/placement/config';
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
 * @param supabase PlacementSupabase
 * @returns Promise<number>
 */
export async function resolvePlacementCooldownDays(supabase: PlacementSupabase): Promise<number> {
  const { data } = await supabase
    .from('test_configs')
    .select('config')
    .eq('code', 'placement_sequential_v1')
    .maybeSingle();

  return parsePlacementCooldownDays((data?.config as Record<string, unknown> | undefined) ?? null);
}

/**
 * @param skill PlacementSkill
 * @param level PlacementLevel
 * @param excludeGroupIds string[]
 * @returns Promise<PlacementStepContent>
 */
export async function fetchStepContent(
  skill: PlacementSkill,
  level: PlacementLevel,
  excludeGroupIds: string[]
): Promise<PlacementStepContent | null> {
  const groupsResult = await fetchGroups({ skill, cefr_level: level, purpose: 'placement' });
  if (!groupsResult.ok) return null;

  const candidate = groupsResult.data.find((group) => !excludeGroupIds.includes(group.id));
  if (!candidate) return null;

  const itemsResult = await fetchGroupItems([candidate.id]);
  if (!itemsResult.ok || itemsResult.data.length === 0) return null;

  return { group: toPublicGroup(candidate), items: itemsResult.data.map(toPublicItem) };
}
