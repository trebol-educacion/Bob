'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import { mapListeningScoreToCefr } from '@/lib/assessment/cefr-mapping';
import type { AssessmentResultListening } from '@/lib/types/skills';
import type { SubmitListeningAnswer, SubmitListeningResult } from './types';
import { resolveCooldownUntil } from './shared';

/**
 * Scores a completed Listening Assessment deterministically.
 * No LLM call — pure comparison against bob_closed_items.correct_key.
 * D-D1 compliance: zero Gemini calls on this path.
 */
export async function submitAssessmentListeningAction(
  assessment_id: string,
  answers: SubmitListeningAnswer[]
): Promise<SubmitListeningResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 'error', code: 'unauthenticated' };

  if (!answers || answers.length === 0) {
    return { status: 'error', code: 'invalid_items' };
  }

  const itemIds = answers.map(a => a.item_id);
  const { data: items, error: itemsError } = await supabase
    .from('closed_items')
    .select('id, correct_key, explanation')
    .in('id', itemIds);

  if (itemsError || !items) return { status: 'error', code: 'db_error' };

  const correctMap = new Map<string, string>(
    items.map(row => [row.id as string, row.correct_key as string])
  );

  let correct = 0;
  const failedItemIds: string[] = [];

  for (const answer of answers) {
    const expectedKey = correctMap.get(answer.item_id);
    if (expectedKey !== undefined && answer.selected_key === expectedKey) {
      correct++;
    } else {
      failedItemIds.push(answer.item_id);
    }
  }

  const total = answers.length;
  const { band, confidence } = mapListeningScoreToCefr(correct, total);

  const confidenceNumeric = confidence === 'low' ? 0.3
    : confidence === 'medium' ? 0.65
    : 0.9;

  try {
    await supabase.schema('public').rpc('set_config', { setting: 'bob.assessment_id', value: assessment_id, is_local: true });
  } catch { /* non-critical */ }

  const { error: upsertError } = await supabase
    .from('skill_levels')
    .upsert({
      user_id: user.id,
      skill: 'listening',
      cefr_level: band,
      origin: 'assessment',
      confidence: confidenceNumeric,
      last_assessment_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,skill' });

  if (upsertError) return { status: 'error', code: 'db_error' };

  const { data: sessionData, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      mode: 'assessment_listening',
      topic: assessment_id,
      title: 'Listening Assessment',
    })
    .select('id')
    .single();

  if (!sessionError && sessionData) {
    await supabase.from('messages').insert({
      session_id: sessionData.id,
      user_id: user.id,
      role: 'bob',
      msg_type: 'evaluation',
      content_text: null,
      content_json: {
        assessment_id,
        status: 'done',
        score: correct,
        score_max: total,
        cefr_band: band,
        confidence,
        failed_item_ids: failedItemIds,
      },
    });
  }

  const cooldownUntil = await resolveCooldownUntil(supabase, user.id);

  const result: AssessmentResultListening = {
    assessment_id,
    skill: 'listening',
    cefr_band: band,
    confidence,
    score: correct,
    score_max: total,
    failed_item_ids: failedItemIds,
    cooldown_until: cooldownUntil,
    feedback: {
      kind: 'formative',
      understood: correct >= Math.ceil(total / 2),
      highlights: correct === total
        ? ['You answered all questions correctly — great listening skills!']
        : [`You got ${correct} out of ${total} correct.`],
      suggestions: failedItemIds.length > 0
        ? ['Review the items you missed and listen to them again.']
        : [],
    },
  };

  return { status: 'ok', result };
}

