'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import type { AssessmentResultSpeaking, AssessmentCefrBand, AssessmentConfidence } from '@/lib/types/skills';
import type { SubmitSpeakingTurn, SubmitSpeakingResult } from './types';
import { resolveCooldownUntil } from './shared';

/**
 * Submits the recorded audio turns for Speaking Assessment.
 * Returns queued immediately (fire-and-forget); evaluation runs in background.
 * D-A1 compliance: never blocks the student waiting for Gemini.
 */
export async function submitAssessmentSpeakingAction(
  assessment_id: string,
  turns: SubmitSpeakingTurn[]
): Promise<SubmitSpeakingResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 'error', code: 'unauthenticated' };

  if (!turns || turns.length === 0 || turns.length > 3) {
    return { status: 'error', code: 'invalid_audio' };
  }

  const totalDurationMs = turns.reduce((acc, t) => acc + t.duration_ms, 0);
  if (totalDurationMs > 3 * 20 * 1000) {
    return { status: 'error', code: 'invalid_audio' };
  }

  const [profileResult, skillLevelResult, studentFwResult] = await Promise.all([
    supabase.schema('public').from('profiles').select('organization_id, cefr_active_level').eq('id', user.id).single(),
    supabase.from('skill_levels').select('cefr_level').eq('user_id', user.id).eq('skill', 'speaking').maybeSingle(),
    supabase.schema('public').from('student_english_frameworks').select('framework_id, pedagogical_frameworks(name)').eq('student_id', user.id),
  ]);

  const profile = profileResult.data;

  const { data: org } = profile?.organization_id
    ? await supabase
        .schema('public').from('organizations')
        .select('allow_voice_storage')
        .eq('id', profile.organization_id)
        .maybeSingle()
    : { data: null };

  const allowVoiceStorage = org?.allow_voice_storage === true;

  const speakingLevel = skillLevelResult.data?.cefr_level ?? profile?.cefr_active_level ?? 'a2';
  const fwNames = (studentFwResult.data ?? []).map((r: Record<string, unknown>) => {
    const pf = r.pedagogical_frameworks as { name?: string } | null;
    return pf?.name ?? '';
  });
  const isYl = fwNames.some((n: string) => n === 'Cambridge English') && (speakingLevel === 'pre_a1' || speakingLevel === 'a1');

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      mode: 'assessment_speaking',
      topic: assessment_id,
      title: 'Speaking Assessment',
    })
    .select('id')
    .single();

  if (sessionError || !session) return { status: 'error', code: 'db_error' };
  const sessionId = session.id;

  for (const turn of turns) {
    const msgInsert: Record<string, unknown> = {
      session_id: sessionId,
      user_id: user.id,
      role: 'user',
      msg_type: allowVoiceStorage ? 'user_audio' : 'text',
      content_text: turn.transcript ?? null,
      content_json: {
        assessment_id,
        turn_number: turn.turn_number,
        duration_ms: turn.duration_ms,
        prompt_key: turn.prompt_key,
        ...(allowVoiceStorage ? { audio_base64: turn.audio_base64, mime_type: turn.mime_type } : {}),
      },
    };
    await supabase.from('messages').insert(msgInsert);
  }

  await supabase
    .from('messages')
    .insert({
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
      skill: 'speaking',
      session_id: sessionId,
      status: 'pending',
      payload: {
        current_level: speakingLevel,
        is_yl: isYl,
      },
    });

  if (queueError) {
    return { status: 'error', code: 'db_error' };
  }

  return { status: 'queued', assessment_id };
}

/**
 * Polls for the Assessment Speaking result.
 * Returns the result if done, 'pending' if still evaluating, or 'failed' on error.
 */
export async function pollAssessmentSpeakingResultAction(
  assessment_id: string
): Promise<
  | { status: 'done'; result: AssessmentResultSpeaking }
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
        skill: 'speaking',
        cefr_band: content.cefr_band as AssessmentCefrBand,
        confidence: content.confidence as AssessmentConfidence,
        feedback: content.feedback as AssessmentResultSpeaking['feedback'],
        cooldown_until: cooldownUntil,
        pending_evaluation: false,
      },
    };
  }

  return { status: 'pending' };
}

