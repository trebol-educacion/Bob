import { createSessionAction } from '@/actions/sessions';
import { persistMessage, persistMessages, persistActivityResult } from '@/lib/persist-activity';
import { createSupabaseServer } from '@/lib/supabase/server';
import { fail, ok, type ActionResult } from '@/lib/result';
import { toScore10 } from '@/lib/session/score';
import { sessionTitle } from '@/lib/session/title';

export interface SessionRef {
  sessionId: string;
  userId: string;
}

export interface EnsuredSession extends SessionRef {
  created: boolean;
}

export interface TurnMessage {
  role: 'bob' | 'user';
  msgType: 'text' | 'phrase' | 'image_scene' | 'evaluation' | 'user_audio' | 'yl_cue' | 'yl_tts';
  contentText?: string | null;
  contentJson?: Record<string, unknown> | unknown[] | null;
}

export interface FinishedSession {
  score10: number | null;
  messageId: string;
}

/** @returns id of the authenticated user, or null */
export async function currentUserId(): Promise<string | null> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * @param input.mode - session mode key
 * @param input.sessionId - existing session to reuse; none creates the row
 * @param input.topic - optional topic stored on the session
 * @param input.title - overrides the canonical title
 * @returns session reference; creates the row only when no sessionId is given
 */
export async function ensureSession(input: {
  mode: string;
  sessionId?: string | null;
  topic?: string | null;
  title?: string;
}): Promise<ActionResult<EnsuredSession>> {
  if (input.sessionId) {
    const userId = await currentUserId();
    if (!userId) return fail('unauthenticated');
    return ok({ sessionId: input.sessionId, userId, created: false });
  }
  const created = await createSessionAction({
    mode: input.mode,
    topic: input.topic ?? null,
    title: input.title ?? sessionTitle(input.mode),
  });
  if (!created.data) {
    const code = created.error === 'placement_required' || created.error === 'unauthenticated' ? created.error : 'session_create_failed';
    return fail(code, code === 'session_create_failed');
  }
  return ok({ sessionId: created.data.id, userId: created.data.user_id, created: true });
}

/**
 * @param input.mode - session mode key
 * @param input.sessionId - existing session to reuse
 * @param input.topic - optional topic stored on the session
 * @param input.opening - messages persisted only when this call creates the session
 * @returns session reference with the opening already persisted
 */
export async function openSession(input: {
  mode: string;
  sessionId?: string | null;
  topic?: string | null;
  opening: TurnMessage[];
}): Promise<ActionResult<SessionRef>> {
  const session = await ensureSession({ mode: input.mode, sessionId: input.sessionId, topic: input.topic });
  if (!session.ok) return session;
  const ref = { sessionId: session.data.sessionId, userId: session.data.userId };
  if (session.data.created) {
    const turn = await recordTurn({ ...ref, messages: input.opening });
    if (!turn.ok) return turn;
  }
  return ok(ref);
}

/**
 * @param input.sessionId - target session
 * @param input.userId - owner of the session
 * @param input.messages - messages of the turn, inserted in one awaited batch
 * @returns inserted message ids
 */
export async function recordTurn(input: SessionRef & { messages: TurnMessage[] }): Promise<ActionResult<{ ids: string[] }>> {
  if (input.messages.length === 0) return ok({ ids: [] });
  const result = await persistMessages(
    input.messages.map((message) => ({ ...message, sessionId: input.sessionId, userId: input.userId })),
  );
  if ('error' in result) return fail('persist_failed', true);
  return ok({ ids: result.ids });
}

async function hasActivityResult(sessionId: string): Promise<boolean> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.from('activity_results').select('id').eq('session_id', sessionId).limit(1).maybeSingle();
  return Boolean(data);
}

/**
 * @param input.sessionId - session being closed
 * @param input.userId - owner of the session
 * @param input.evaluation - final evaluation payload; is_final is forced to true
 * @returns canonical 0-10 grade and the final message id; activity_results is written before returning
 */
export async function finishSession(
  input: SessionRef & { evaluation: Record<string, unknown> },
): Promise<ActionResult<FinishedSession>> {
  const evaluation = { ...input.evaluation, is_final: true };
  const score10 = toScore10(evaluation);

  const supabase = await createSupabaseServer();
  const { data: session, error: updateError } = await supabase
    .from('sessions')
    .update({ score_10: score10 })
    .eq('id', input.sessionId)
    .eq('user_id', input.userId)
    .select('mode')
    .single();
  if (updateError || !session) return fail('session_update_failed', true);

  const message = await persistMessage({
    sessionId: input.sessionId,
    userId: input.userId,
    role: 'bob',
    msgType: 'evaluation',
    contentText: null,
    contentJson: evaluation,
    skipActivityResult: true,
  });
  if (!('id' in message)) return fail('persist_failed', true);

  if (!(await hasActivityResult(input.sessionId))) {
    await persistActivityResult({
      sessionId: input.sessionId,
      userId: input.userId,
      messageId: message.id,
      mode: (session as { mode: string }).mode,
      contentJson: evaluation,
    });
  }
  return ok({ score10, messageId: message.id });
}
