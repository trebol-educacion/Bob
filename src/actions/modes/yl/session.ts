'use server';

import { randomUUID } from 'node:crypto';
import { type ModeKey } from '@/lib/types/practice';
import { YLPlanSchema, type YLPlan } from '@/lib/types/yl';
import { createSupabaseServer } from '@/lib/supabase/server';
import { safeParseFallback } from '@/lib/gemini-client';
import { ensureSession, recordTurn } from '@/lib/session/lifecycle';
import { fail, ok, type ActionResult } from '@/lib/result';
import { getMessagesAction } from '@/actions/messages';
import { parseYLMode, YLPlanFallback } from './_helpers';
import { generateYLContentAction } from './content';

export async function startYLSessionAction(input: {
  mode: ModeKey;
}): Promise<{ draftId: string; plan: YLPlan }> {
  const { exam, part } = parseYLMode(input.mode);
  const draftId = randomUUID();

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.error(JSON.stringify({ event: 'startYLSessionAction', error: 'Not authenticated' }));
    return { draftId, plan: YLPlanFallback };
  }

  const { data: recent } = await supabase
    .from('sessions')
    .select('plan_json')
    .eq('user_id', user.id)
    .eq('mode', input.mode)
    .not('plan_json', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  const avoidSummary = (recent ?? [])
    .map((r) => {
      const p = r.plan_json as { options?: string[]; cues?: unknown[] } | null;
      if (!p) return null;
      if (p.options && p.options.length > 0) return `[${p.options.join(', ')}]`;
      if (p.cues && p.cues.length > 0)
        return `[${(p.cues as Array<string | { text?: string }>).map((c) => (typeof c === 'string' ? c : c.text ?? '')).slice(0, 3).join(' | ')}…]`;
      return null;
    })
    .filter((s): s is string => s !== null)
    .join('\n- ');

  const avoidList = avoidSummary ? `- ${avoidSummary}` : '(none yet, feel free to pick any topic)';

  const t1 = Date.now();
  const plan = await generateYLContentAction(exam, part, { avoidList });
  console.log(`[YL][${input.mode}] plan ready in ${Date.now() - t1}ms (cues=${plan.cues?.length ?? 0}, images=${plan.image_prompts?.length ?? 0})`);

  return { draftId, plan };
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
    messages: (input.images ?? []).map((image, index) => ({
      role: 'bob' as const,
      msgType: 'image_scene' as const,
      contentText: null,
      contentJson: { image_data_uri: image, image_index: index },
    })),
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
