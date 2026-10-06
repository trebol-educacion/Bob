'use server';

import { randomUUID } from 'node:crypto';
import { type ModeKey } from '@/lib/types/practice';
import { YLPlanSchema, type YLPlan } from '@/lib/types/yl';
import { createSupabaseServer } from '@/lib/supabase/server';
import { safeParseFallback } from '@/lib/gemini-client';
import { pickPlan, bankStamp } from '@/lib/item-bank/plan-bank';
import { expectedImages, YlBankPlanSchema, YL_CEFR_BY_EXAM, YL_EXAM_BY_BANK } from '@/lib/bank-plans/yl-plan';
import { currentUserId, ensureSession, recordTurn } from '@/lib/session/lifecycle';
import { fail, ok, type ActionResult } from '@/lib/result';
import { getMessagesAction } from '@/actions/messages';
import { parseYLMode, YLPlanFallback } from './_helpers';

function shuffled<T>(values: T[]): T[] {
  return [...values].sort(() => Math.random() - 0.5);
}

function withShuffledCues(examPart: string, plan: YLPlan): YLPlan {
  if (examPart === 'starters_part1' && plan.pointing_cues && plan.pointing_cues.length > 1) {
    const pointingCues = shuffled(plan.pointing_cues);
    return { ...plan, pointing_cues: pointingCues, cues: pointingCues.map((c) => c.text) };
  }
  if (examPart === 'movers_part1' && plan.differences && plan.differences.length > 1) {
    const differences = shuffled(plan.differences);
    return { ...plan, differences, cues: differences.map((d) => d.examiner_cue) };
  }
  return plan;
}

export async function startYLSessionAction(input: {
  mode: ModeKey;
}): Promise<ActionResult<{ draftId: string; plan: YLPlan }>> {
  const { exam, part } = parseYLMode(input.mode);
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');
  const examPart = `${exam}_part${part}`;
  const picked = await pickPlan({
    exam: YL_EXAM_BY_BANK[exam],
    cefr: YL_CEFR_BY_EXAM[exam],
    examPart,
    skill: 'speaking',
    schema: YlBankPlanSchema,
    userId,
  });
  if (!picked.ok) return picked;
  const plan = { ...picked.data.plan, bank_group_id: picked.data.groupId };
  if ((plan.image_urls ?? []).length < expectedImages(examPart)) return fail('no_content');
  return ok({ draftId: randomUUID(), plan: withShuffledCues(examPart, plan) });
}

export async function openYLSessionAction(input: {
  mode: ModeKey;
  plan: YLPlan;
  images?: string[];
}): Promise<ActionResult<{ sessionId: string }>> {
  const { exam, part } = parseYLMode(input.mode);
  const session = await ensureSession({ mode: input.mode, topic: `${exam}_part${part}` });
  if (!session.ok) return session;

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from('sessions')
    .update({ plan_json: input.plan })
    .eq('id', session.data.sessionId)
    .eq('user_id', session.data.userId);
  if (error) return fail('plan_persist_failed', true);

  const turn = await recordTurn({
    sessionId: session.data.sessionId,
    userId: session.data.userId,
    messages: [
      {
        role: 'bob' as const,
        msgType: 'yl_tts' as const,
        contentText: null,
        contentJson: { kind: 'yl_plan_stamp', ...bankStamp(`${exam}_part${part}`, input.plan.bank_group_id) },
      },
      ...(input.images ?? []).map((image, index) => ({
        role: 'bob' as const,
        msgType: 'image_scene' as const,
        contentText: null,
        contentJson: { image_data_uri: image, image_index: index },
      })),
    ],
  });
  if (!turn.ok) return turn;
  return ok({ sessionId: session.data.sessionId });
}

export async function getSessionMessagesAction(sessionId: string) {
  return getMessagesAction(sessionId);
}

export async function getYLSessionPlanAction(sessionId: string): Promise<YLPlan | null> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('sessions')
    .select('plan_json')
    .eq('id', sessionId)
    .maybeSingle();
  if (error || !data || !data.plan_json) return null;
  return safeParseFallback(YLPlanSchema, data.plan_json, YLPlanFallback);
}
