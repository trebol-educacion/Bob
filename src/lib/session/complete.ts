import { ensureSession, finishSession, recordTurn, type TurnMessage } from '@/lib/session/lifecycle';
import { ok, type ActionResult } from '@/lib/result';

export interface CompletedActivity {
  sessionId: string;
  score10: number | null;
}

/**
 * @param input.mode - session mode key
 * @param input.sessionId - existing session; none creates the row on this first turn
 * @param input.plan - exercise payload persisted only when the session is created here
 * @param input.answers - student answers persisted as user turns
 * @param input.answerTexts - free-text student turns persisted with their text
 * @param input.evaluation - final evaluation payload
 * @returns session id and canonical grade; session, turns, result and activity_results are awaited
 */
export async function completeActivity(input: {
  mode: string;
  sessionId?: string | null;
  topic?: string | null;
  plan: object | null;
  answers: Array<Record<string, unknown>>;
  answerTexts?: Array<{ contentText: string; contentJson: Record<string, unknown> | null }>;
  evaluation: Record<string, unknown>;
}): Promise<ActionResult<CompletedActivity>> {
  const session = await ensureSession({ mode: input.mode, sessionId: input.sessionId, topic: input.topic });
  if (!session.ok) return session;
  const ref = { sessionId: session.data.sessionId, userId: session.data.userId };

  const messages: TurnMessage[] = [];
  if (session.data.created && input.plan) {
    messages.push({ role: 'bob', msgType: 'text', contentText: null, contentJson: input.plan as Record<string, unknown> });
  }
  for (const answer of input.answers) {
    messages.push({ role: 'user', msgType: 'text', contentText: null, contentJson: answer });
  }
  for (const answer of input.answerTexts ?? []) {
    messages.push({ role: 'user', msgType: 'text', contentText: answer.contentText, contentJson: answer.contentJson });
  }
  const turn = await recordTurn({ ...ref, messages });
  if (!turn.ok) return turn;

  const finished = await finishSession({ ...ref, evaluation: input.evaluation });
  if (!finished.ok) return finished;
  return ok({ sessionId: ref.sessionId, score10: finished.data.score10 });
}
