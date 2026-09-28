'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import { nextPlacementStep } from '@/lib/placement/engine';
import { fetchStepContent, parseStoredPlacementState, resolvePlacementConfig } from './shared';
import type { PlacementSkill } from './shared';
import type { PublicBankItem, PublicItemGroup } from '@/lib/item-bank/types';
import type { PlacementLevel } from '@/lib/placement/types';

export type ResumePlacementResult =
  | { status: 'ok'; attempt_id: string; level: PlacementLevel; group: PublicItemGroup; items: PublicBankItem[] }
  | { status: 'none' }
  | { status: 'fallback' }
  | { status: 'error'; code: 'unauthenticated' };

/**
 * @param skill PlacementSkill
 * @returns Promise<ResumePlacementResult>
 */
export async function resumePlacementAction(skill: PlacementSkill): Promise<ResumePlacementResult> {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { status: 'error', code: 'unauthenticated' };

    const { data: existing, error } = await supabase
      .from('placement_attempts')
      .select('id, state')
      .eq('user_id', user.id)
      .eq('skill', skill)
      .eq('status', 'in_progress')
      .maybeSingle();

    if (error) return { status: 'fallback' };
    if (!existing) return { status: 'none' };

    const state = parseStoredPlacementState(existing.state);
    const config = await resolvePlacementConfig(supabase);
    const decision = nextPlacementStep({ outcomes: state.outcomes }, config);
    if (decision.done) return { status: 'fallback' };

    const content = await fetchStepContent(skill, decision.nextLevel, state.outcomes.map((o) => o.groupId));
    if (!content) return { status: 'fallback' };

    return { status: 'ok', attempt_id: existing.id as string, level: decision.nextLevel, group: content.group, items: content.items };
  } catch {
    return { status: 'fallback' };
  }
}
