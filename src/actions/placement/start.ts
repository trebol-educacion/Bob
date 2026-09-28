'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import { hasPendingAssessment } from '@/actions/assessment/queue-guard';
import { nextPlacementStep } from '@/lib/placement/engine';
import {
  fetchStepContent,
  parseStoredPlacementState,
  resolvePlacementConfig,
  resolvePlacementCooldownDays,
} from './shared';
import type { PlacementSkill } from './shared';
import type { PublicBankItem, PublicItemGroup } from '@/lib/item-bank/types';
import type { PlacementLevel } from '@/lib/placement/types';

export type StartPlacementResult =
  | { status: 'ok'; attempt_id: string; level: PlacementLevel; group: PublicItemGroup; items: PublicBankItem[] }
  | { status: 'fallback' }
  | { status: 'cooldown'; days_remaining: number; available_at: string }
  | { status: 'pending' }
  | { status: 'error'; code: 'unauthenticated' };

/**
 * @param skill PlacementSkill
 * @returns Promise<StartPlacementResult>
 */
export async function startPlacementAction(skill: PlacementSkill): Promise<StartPlacementResult> {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { status: 'error', code: 'unauthenticated' };

    if (await hasPendingAssessment(supabase, user.id, skill)) {
      return { status: 'pending' };
    }

    const { data: existing, error: existingError } = await supabase
      .from('placement_attempts')
      .select('id, state')
      .eq('user_id', user.id)
      .eq('skill', skill)
      .eq('status', 'in_progress')
      .maybeSingle();

    if (existingError) return { status: 'fallback' };

    const config = await resolvePlacementConfig(supabase);

    if (existing) {
      const state = parseStoredPlacementState(existing.state);
      const decision = nextPlacementStep({ outcomes: state.outcomes }, config);
      if (decision.done) return { status: 'fallback' };

      const content = await fetchStepContent(skill, decision.nextLevel, state.outcomes.map((o) => o.groupId));
      if (!content) return { status: 'fallback' };

      return { status: 'ok', attempt_id: existing.id as string, level: decision.nextLevel, group: content.group, items: content.items };
    }

    const cooldownResult = await checkCooldown(supabase, user.id, skill);
    if (cooldownResult) return cooldownResult;

    const decision = nextPlacementStep({ outcomes: [] }, config);
    if (decision.done) return { status: 'fallback' };

    const content = await fetchStepContent(skill, decision.nextLevel, []);
    if (!content) return { status: 'fallback' };

    const { data: created, error: createError } = await supabase
      .from('placement_attempts')
      .insert({ user_id: user.id, skill, status: 'in_progress', state: { outcomes: [] } })
      .select('id')
      .single();

    if (createError || !created) return { status: 'fallback' };

    return { status: 'ok', attempt_id: created.id as string, level: decision.nextLevel, group: content.group, items: content.items };
  } catch {
    return { status: 'fallback' };
  }
}

export type CancelPlacementResult = { ok: boolean };

/**
 * @param attemptId string
 * @returns Promise<CancelPlacementResult>
 */
export async function cancelPlacementAction(attemptId: string): Promise<CancelPlacementResult> {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false };

    const { error } = await supabase
      .from('placement_attempts')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .eq('id', attemptId)
      .eq('user_id', user.id)
      .eq('status', 'in_progress');

    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

/**
 * @param supabase Awaited<ReturnType<typeof createSupabaseServer>>
 * @param userId string
 * @param skill PlacementSkill
 * @returns Promise<StartPlacementResult>
 */
async function checkCooldown(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  userId: string,
  skill: PlacementSkill
): Promise<StartPlacementResult | null> {
  const { data: lastCompleted } = await supabase
    .from('placement_attempts')
    .select('completed_at')
    .eq('user_id', userId)
    .eq('skill', skill)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const completedAt = lastCompleted?.completed_at as string | undefined;
  if (!completedAt) return null;

  const cooldownDays = await resolvePlacementCooldownDays(supabase);
  const availableAt = new Date(completedAt).getTime() + cooldownDays * 24 * 60 * 60 * 1000;

  if (Date.now() < availableAt) {
    return {
      status: 'cooldown',
      days_remaining: Math.ceil((availableAt - Date.now()) / (24 * 60 * 60 * 1000)),
      available_at: new Date(availableAt).toISOString(),
    };
  }

  return null;
}
