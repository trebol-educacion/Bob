'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import { fetchGroupItems } from '@/actions/item-bank/repository';
import { scoreClosedAnswers } from '@/lib/item-bank/scoring';
import { currentPlacementLevel, nextPlacementStep } from '@/lib/placement/engine';
import { fetchStepContent, parseStoredPlacementState, resolvePlacementConfig } from './shared';
import type { PlacementSkill, StoredPlacementOutcome } from './shared';
import type { ClosedAnswer } from '@/lib/item-bank/scoring';
import type { PublicBankItem, PublicItemGroup } from '@/lib/item-bank/types';
import type { PlacementLevel } from '@/lib/placement/types';

export type AnswerPlacementStepResult =
  | { status: 'ok'; done: false; attempt_id: string; level: PlacementLevel; group: PublicItemGroup; items: PublicBankItem[] }
  | { status: 'ok'; done: true; attempt_id: string; result_level: PlacementLevel }
  | { status: 'error'; code: 'unauthenticated' | 'invalid_step' | 'db_error' };

/**
 * @param attemptId string
 * @param skill PlacementSkill
 * @param groupId string
 * @param answers ClosedAnswer[]
 * @returns Promise<AnswerPlacementStepResult>
 */
export async function answerPlacementStepAction(
  attemptId: string,
  skill: PlacementSkill,
  groupId: string,
  answers: ClosedAnswer[]
): Promise<AnswerPlacementStepResult> {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { status: 'error', code: 'unauthenticated' };

    const { data: attempt, error: attemptError } = await supabase
      .from('placement_attempts')
      .select('id, state')
      .eq('id', attemptId)
      .eq('user_id', user.id)
      .eq('skill', skill)
      .eq('status', 'in_progress')
      .maybeSingle();

    if (attemptError) return { status: 'error', code: 'db_error' };
    if (!attempt) return { status: 'error', code: 'invalid_step' };

    const state = parseStoredPlacementState(attempt.state);
    const config = await resolvePlacementConfig(supabase);
    if (state.outcomes.some((outcome) => outcome.groupId === groupId)) {
      const settled = nextPlacementStep({ outcomes: state.outcomes }, config);
      if (!settled.done) return { status: 'error', code: 'invalid_step' };
      return await finishAttempt(supabase, user.id, attemptId, skill, settled.resultLevel);
    }

    const pendingDecision = nextPlacementStep({ outcomes: state.outcomes }, config);
    if (pendingDecision.done) return { status: 'error', code: 'invalid_step' };

    const { data: groupRow, error: groupError } = await supabase
      .from('item_groups')
      .select('id, cefr_level')
      .eq('id', groupId)
      .eq('status', 'published')
      .maybeSingle();

    if (groupError) return { status: 'error', code: 'db_error' };
    if (!groupRow || groupRow.cefr_level !== pendingDecision.nextLevel) {
      return { status: 'error', code: 'invalid_step' };
    }

    const itemsResult = await fetchGroupItems([groupId]);
    if (!itemsResult.ok || itemsResult.data.length === 0) return { status: 'error', code: 'db_error' };

    const score = scoreClosedAnswers(itemsResult.data, answers);
    const newOutcome: StoredPlacementOutcome = {
      level: pendingDecision.nextLevel,
      correct: score.correct,
      total: score.total,
      groupId,
    };
    const newOutcomes = [...state.outcomes, newOutcome];

    const { error: updateError } = await supabase
      .from('placement_attempts')
      .update({ state: { outcomes: newOutcomes }, updated_at: new Date().toISOString() })
      .eq('id', attemptId);

    if (updateError) return { status: 'error', code: 'db_error' };

    const decision = nextPlacementStep({ outcomes: newOutcomes }, config);

    if (!decision.done) {
      const content = await fetchStepContent(skill, decision.nextLevel, newOutcomes.map((o) => o.groupId));
      if (!content.ok) {
        if (content.code !== 'no_content') return { status: 'error', code: 'db_error' };
        return await finishAttempt(supabase, user.id, attemptId, skill, currentPlacementLevel(newOutcomes, config));
      }
      return { status: 'ok', done: false, attempt_id: attemptId, level: decision.nextLevel, group: content.data.group, items: content.data.items };
    }

    return await finishAttempt(supabase, user.id, attemptId, skill, decision.resultLevel);
  } catch {
    return { status: 'error', code: 'db_error' };
  }
}

/**
 * @param supabase Awaited<ReturnType<typeof createSupabaseServer>>
 * @param userId string
 * @param attemptId string
 * @param skill PlacementSkill
 * @param resultLevel PlacementLevel
 * @returns Promise<AnswerPlacementStepResult>
 */
async function finishAttempt(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  userId: string,
  attemptId: string,
  skill: PlacementSkill,
  resultLevel: PlacementLevel
): Promise<AnswerPlacementStepResult> {
  const { error } = await supabase
    .from('skill_levels')
    .upsert(
      {
        user_id: userId,
        skill,
        cefr_level: resultLevel,
        origin: 'assessment',
        confidence: null,
        last_assessment_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,skill' }
    );

  if (error) {
    console.error('[answerPlacementStepAction] skill_levels upsert failed:', error.message);
    return { status: 'error', code: 'db_error' };
  }

  const { error: completeError } = await supabase
    .from('placement_attempts')
    .update({ status: 'completed', completed_at: new Date().toISOString(), result_level: resultLevel })
    .eq('id', attemptId);

  if (completeError) {
    console.error('[answerPlacementStepAction] attempt completion failed:', completeError.message);
    return { status: 'error', code: 'db_error' };
  }

  return { status: 'ok', done: true, attempt_id: attemptId, result_level: resultLevel };
}
