'use server';

import { ensureSession, recordTurn, finishSession, currentUserId, type TurnMessage } from '@/lib/session/lifecycle';
import { fail, ok, type ActionResult } from '@/lib/result';
import { buildPracticeSummary } from '@/lib/session/practice-summary';

export async function openGenericSessionAction(input: {
  mode: string;
  topic: string;
  title: string;
}): Promise<ActionResult<{ sessionId: string }>> {
  const session = await ensureSession({ mode: input.mode, topic: input.topic, title: input.title });
  if (!session.ok) return session;
  return ok({ sessionId: session.data.sessionId });
}

export async function recordGenericTurnAction(input: {
  sessionId: string;
  messages: TurnMessage[];
}): Promise<ActionResult<{ ids: string[] }>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');
  return recordTurn({ sessionId: input.sessionId, userId, messages: input.messages });
}

export async function finishGenericSessionAction(input: {
  sessionId: string;
  scores: number[];
}): Promise<ActionResult<{ score10: number | null }>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');
  const finished = await finishSession({
    sessionId: input.sessionId,
    userId,
    evaluation: buildPracticeSummary(input.scores),
  });
  if (!finished.ok) return finished;
  return ok({ score10: finished.data.score10 });
}
