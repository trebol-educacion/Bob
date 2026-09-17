'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import type { AssessmentResultWriting, AssessmentWritingFeedback, AssessmentCefrBand, AssessmentConfidence } from '@/lib/types/skills';
import type { SubmitWritingResult } from './types';
import { resolveCooldownUntil } from './shared';

/**
 * Persists the student's written text and fires background evaluation.
 * D-A1 compliance: returns 'queued' immediately; Gemini runs in background.
 */
export async function submitAssessmentWritingAction(
  assessment_id: string,
  written_text: string
): Promise<SubmitWritingResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 'error', code: 'unauthenticated' };

  const wordCount = written_text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 10) return { status: 'error', code: 'text_too_short' };

  const [profileResult, skillLevelResult] = await Promise.all([
    supabase.schema('public').from('profiles').select('cefr_active_level').eq('id', user.id).single(),
    supabase.from('skill_levels').select('cefr_level').eq('user_id', user.id).eq('skill', 'writing').maybeSingle(),
  ]);

  const profile = profileResult.data;
  const writingLevel = skillLevelResult.data?.cefr_level ?? profile?.cefr_active_level ?? 'a1';

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      mode: 'assessment_writing',
      topic: assessment_id,
      title: 'Writing Assessment',
    })
    .select('id')
    .single();

  if (sessionError || !session) return { status: 'error', code: 'db_error' };
  const sessionId = session.id;

  await supabase.from('messages').insert({
    session_id: sessionId,
    user_id: user.id,
    role: 'user',
    msg_type: 'text',
    content_text: written_text,
    content_json: { assessment_id, word_count: wordCount },
  });

  await supabase.from('messages').insert({
    session_id: sessionId,
    user_id: user.id,
    role: 'bob',
    msg_type: 'evaluation',
    content_text: null,
    content_json: { assessment_id, status: 'pending' },
  });

  const { error: queueError } = await supabase
    .from('assessment_queue')
    .insert({
      user_id: user.id,
      assessment_id,
      skill: 'writing',
      session_id: sessionId,
      status: 'pending',
      payload: {
        current_level: writingLevel,
        written_text,
      },
    });

  if (queueError) {
    return { status: 'error', code: 'db_error' };
  }

  return { status: 'queued', assessment_id };
}

/**
 * Polls for the Writing Assessment result.
 * Returns 'done' with result, 'pending' if still evaluating, or 'failed' on error.
 */
export async function pollAssessmentWritingResultAction(
  assessment_id: string
): Promise<
  | { status: 'done'; result: AssessmentResultWriting }
  | { status: 'pending' }
  | { status: 'failed'; error: string }
  | { status: 'error'; code: string }
> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 'error', code: 'unauthenticated' };

  const { data: messages } = await supabase
    .from('messages')
    .select('content_json')
    .eq('user_id', user.id)
    .eq('role', 'bob')
    .eq('msg_type', 'evaluation')
    .filter('content_json->>assessment_id', 'eq', assessment_id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!messages || messages.length === 0) return { status: 'pending' };

  const content = messages[0].content_json as Record<string, unknown>;
  if (!content) return { status: 'pending' };

  const msgStatus = content.status as string;

  if (msgStatus === 'pending') return { status: 'pending' };

  if (msgStatus === 'failed') {
    return { status: 'failed', error: (content.error as string) ?? 'Evaluation failed' };
  }

  if (msgStatus === 'done') {
    const cooldownUntil = (content.cooldown_until as string) ?? await resolveCooldownUntil(supabase, user.id);
    return {
      status: 'done',
      result: {
        assessment_id,
        skill: 'writing',
        cefr_band: content.cefr_band as AssessmentCefrBand,
        confidence: content.confidence as AssessmentConfidence,
        bullets_covered: (content.bullets_covered as number) ?? 0,
        feedback: content.feedback as AssessmentWritingFeedback,
        cooldown_until: cooldownUntil,
      },
    };
  }

  return { status: 'pending' };
}

