'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import { inferSkillFromMode, inferModeMetadata } from '@/lib/skill-from-mode';

export interface PersistMessageInput {
  sessionId: string;
  userId: string;
  role: 'bob' | 'user';
  msgType: 'text' | 'phrase' | 'image_scene' | 'evaluation' | 'user_audio' | 'yl_cue' | 'yl_tts';
  contentText?: string | null;
  contentJson?: Record<string, unknown> | unknown[] | null;
}

/** Returns true only when the user's org has allow_voice_storage=true; defaults to false on any error. */
async function isVoiceStorageAllowed(userId: string): Promise<boolean> {
  const supabase = await createSupabaseServer();
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .single();

  if (profileError || !profile?.organization_id) return false;

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('allow_voice_storage')
    .eq('id', profile.organization_id)
    .single();

  if (orgError || !org) return false;
  return org.allow_voice_storage === true;
}

/** Insert a single message row into bob_messages; returns the new id or an error string. */
export async function persistMessage(
  input: PersistMessageInput
): Promise<{ id: string } | { skipped: true } | { error: string }> {
  if (input.msgType === 'user_audio') {
    const allowed = await isVoiceStorageAllowed(input.userId);
    if (!allowed) {
      console.log(JSON.stringify({ event: 'audio_persist_skipped', userId: input.userId, reason: 'allow_voice_storage=false' }));
      return { skipped: true };
    }
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('bob_messages')
    .insert({
      session_id: input.sessionId,
      user_id: input.userId,
      role: input.role,
      msg_type: input.msgType,
      content_text: input.contentText ?? null,
      content_json: input.contentJson ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[persist-activity] insert failed:', error.message);
    return { error: error.message };
  }

  const newId = (data as { id: string }).id;

  if (
    input.msgType === 'evaluation' &&
    input.contentJson !== null &&
    input.contentJson !== undefined &&
    !Array.isArray(input.contentJson) &&
    (input.contentJson as Record<string, unknown>).is_final === true
  ) {
    void resolveSessionMode(input.sessionId).then((mode) =>
      persistActivityResult({
        sessionId: input.sessionId,
        userId: input.userId,
        messageId: newId,
        mode,
        contentJson: input.contentJson as Record<string, unknown>,
      })
    ).catch(() => undefined);
  }

  return { id: newId };
}

/** Batch-insert multiple message rows into bob_messages; returns inserted ids or an error string. */
export async function persistMessages(
  inputs: PersistMessageInput[]
): Promise<{ ids: string[] } | { error: string }> {
  if (inputs.length === 0) return { ids: [] };

  const audioInputs = inputs.filter((i) => i.msgType === 'user_audio');
  let filteredInputs = inputs;

  if (audioInputs.length > 0) {
    const firstAudioUserId = audioInputs[0].userId;
    const allowed = await isVoiceStorageAllowed(firstAudioUserId);
    if (!allowed) {
      console.log(JSON.stringify({ event: 'audio_persist_skipped', userId: firstAudioUserId, reason: 'allow_voice_storage=false', count: audioInputs.length }));
      filteredInputs = inputs.filter((i) => i.msgType !== 'user_audio');
    }
  }

  if (filteredInputs.length === 0) return { ids: [] };

  const supabase = await createSupabaseServer();
  const rows = filteredInputs.map((input) => ({
    session_id: input.sessionId,
    user_id: input.userId,
    role: input.role,
    msg_type: input.msgType,
    content_text: input.contentText ?? null,
    content_json: input.contentJson ?? null,
  }));

  const { data, error } = await supabase
    .from('bob_messages')
    .insert(rows)
    .select('id');

  if (error) {
    console.error('[persist-activity] batch insert failed:', error.message);
    return { error: error.message };
  }
  return { ids: (data as Array<{ id: string }>).map((r) => r.id) };
}

/** Read all messages for a session ordered by created_at ASC; returns empty array on error. */
export async function readSessionMessages(
  sessionId: string,
  userId: string
): Promise<
  Array<{
    id: string;
    role: 'bob' | 'user';
    msg_type: string;
    content_text: string | null;
    content_json: unknown;
    created_at: string;
  }>
> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('bob_messages')
    .select('id, role, msg_type, content_text, content_json, created_at')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[persist-activity] readSessionMessages failed:', error.message);
    return [];
  }
  return (data ?? []) as Array<{
    id: string;
    role: 'bob' | 'user';
    msg_type: string;
    content_text: string | null;
    content_json: unknown;
    created_at: string;
  }>;
}

async function resolveSessionMode(sessionId: string): Promise<string> {
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
      .from('bob_sessions')
      .select('mode')
      .eq('id', sessionId)
      .single();
    if (error || !data) return '';
    return (data as { mode: string }).mode ?? '';
  } catch {
    return '';
  }
}

export interface PersistActivityResultInput {
  sessionId: string;
  userId: string;
  messageId: string | null;
  mode: string;
  contentJson: Record<string, unknown>;
}

function deriveScore10(raw: number, max: number): number | null {
  if (max <= 0) return null;
  return Math.round((raw / max) * 100) / 10;
}

/** Persists a graded result row in bob_activity_results. Fire-and-forget safe: never throws. */
export async function persistActivityResult(
  input: PersistActivityResultInput,
): Promise<{ id: string } | { skipped: true } | { error: string }> {
  try {
    if (input.contentJson.is_final !== true) return { skipped: true };

    const skill = inferSkillFromMode(input.mode);
    if (!skill) return { skipped: true };

    const { framework, exam_part, cefr_level } = inferModeMetadata(input.mode);

    const hasScore =
      typeof input.contentJson.score === 'number' &&
      typeof input.contentJson.score_max === 'number';

    let measure_type: 'score' | 'rubric';
    let raw_score: number | null = null;
    let max_score: number | null = null;
    let score_10: number | null = null;
    let rubric_json: Record<string, unknown> | null = null;

    if (hasScore) {
      measure_type = 'score';
      raw_score = input.contentJson.score as number;
      max_score = input.contentJson.score_max as number;
      score_10 = deriveScore10(raw_score, max_score);
    } else {
      measure_type = 'rubric';
      const rubric = input.contentJson.rubric as Record<string, unknown> | undefined;
      if (
        rubric &&
        typeof rubric.task_coverage === 'number' &&
        typeof rubric.grammar === 'number' &&
        typeof rubric.vocabulary === 'number' &&
        typeof rubric.fluency === 'number'
      ) {
        raw_score = rubric.task_coverage + rubric.grammar + rubric.vocabulary + rubric.fluency;
        max_score = 16;
        score_10 = deriveScore10(raw_score, max_score);
        rubric_json = { ...rubric, max_per_criterion: 4 };
      }
    }

    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
      .from('bob_activity_results')
      .insert({
        user_id: input.userId,
        session_id: input.sessionId,
        message_id: input.messageId,
        mode: input.mode,
        framework,
        exam_part,
        cefr_level,
        skill,
        measure_type,
        raw_score,
        max_score,
        score_10,
        rubric_json,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[persist-activity] activity result insert failed:', error.message);
      return { error: error.message };
    }

    return { id: (data as { id: string }).id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[persist-activity] persistActivityResult unexpected error:', msg);
    return { error: msg };
  }
}
