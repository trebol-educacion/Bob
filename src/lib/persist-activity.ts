import { createSupabaseServer } from '@/lib/supabase/server';

export interface PersistMessageInput {
  sessionId: string;
  userId: string;
  role: 'bob' | 'user';
  msgType: 'text' | 'phrase' | 'image_scene' | 'evaluation' | 'user_audio' | 'yl_cue' | 'yl_tts';
  contentText?: string | null;
  contentJson?: Record<string, unknown> | unknown[] | null;
}

/** Insert a single message row into bob_messages; returns the new id or an error string. */
export async function persistMessage(
  input: PersistMessageInput
): Promise<{ id: string } | { error: string }> {
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
  return { id: (data as { id: string }).id };
}

/** Batch-insert multiple message rows into bob_messages; returns inserted ids or an error string. */
export async function persistMessages(
  inputs: PersistMessageInput[]
): Promise<{ ids: string[] } | { error: string }> {
  if (inputs.length === 0) return { ids: [] };

  const supabase = await createSupabaseServer();
  const rows = inputs.map((input) => ({
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
