'use server';

import { type ModeKey } from '@/lib/types/practice';
import { YLPlanSchema, type YLPlan } from '@/lib/types/yl';
import { createSupabaseServer } from '@/lib/supabase/server';
import { safeParseFallback } from '@/lib/gemini-client';
import { getMessagesAction } from '@/actions/messages';
import { parseYLMode, YLPlanFallback } from './_helpers';
import { generateYLContentAction } from './content';

export async function startYLSessionAction(input: {
  mode: ModeKey;
}): Promise<{ sessionId: string; plan: YLPlan }> {
  const { exam, part } = parseYLMode(input.mode);

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.error(JSON.stringify({ event: 'startYLSessionAction', error: 'Not authenticated' }));
    return { sessionId: '', plan: YLPlanFallback };
  }

  const partTitles: Record<string, string> = {
    starters_1: 'Starters Part 1 — Listen and Point',
    starters_2: 'Starters Part 2 — Look and Answer',
    starters_3: "Starters Part 3 — What's This?",
    starters_4: 'Starters Part 4 — Personal Questions',
    movers_1: 'Movers Part 1 — Find the Differences',
    movers_2: 'Movers Part 2 — Information Exchange',
    movers_3: 'Movers Part 3 — Tell the Story',
    movers_4: 'Movers Part 4 — Personal Questions',
    movers_5: 'Movers Part 5 — More About You',
  };
  const titleKey = `${exam}_${part}`;
  const title = partTitles[titleKey] ?? `Cambridge ${exam} Part ${part}`;

  const { data: session, error: sessionErr } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      mode: input.mode,
      topic: `${exam}_part${part}`,
      title,
    })
    .select()
    .single();

  if (sessionErr || !session) {
    console.error(JSON.stringify({ event: 'startYLSessionAction', error: sessionErr?.message ?? 'no session' }));
    return { sessionId: '', plan: YLPlanFallback };
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

  const avoidList = avoidSummary ? `- ${avoidSummary}` : '(none yet — feel free to pick any topic)';

  const t1 = Date.now();
  const plan = await generateYLContentAction(exam, part, { avoidList });
  console.log(`[YL][${input.mode}] plan ready in ${Date.now() - t1}ms (cues=${plan.cues?.length ?? 0}, images=${plan.image_prompts?.length ?? 0})`);

  await supabase.from('sessions').update({ plan_json: plan }).eq('id', session.id);

  return { sessionId: session.id as string, plan };
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
