'use server';

import { type EvalResponse } from '@/lib/types/practice';
import { persistMessages } from '@/lib/persist-activity';
import { currentUserId, finishSession } from '@/lib/session/lifecycle';
import { fail, ok, type ActionResult } from '@/lib/result';

export async function saveYLFinalEvalAction(
  sessionId: string,
  evalResult: EvalResponse
): Promise<ActionResult<{ score10: number | null }>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');
  const finished = await finishSession({ sessionId, userId, evaluation: { ...evalResult } });
  if (!finished.ok) return finished;
  return ok({ score10: finished.data.score10 });
}

export async function saveYLTurnAction(
  sessionId: string,
  turn: {
    cue: string;
    cueIndex: number;
    transcript: string;
    reaction: string;
    score?: number;
    evalResult?: EvalResponse;
  }
): Promise<ActionResult<{ saved: number }>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');

  const result = await persistMessages([
    {
      sessionId,
      userId,
      role: 'user',
      msgType: 'text',
      contentText: turn.transcript,
      contentJson: {
        kind: 'yl_turn',
        cue: turn.cue,
        cue_index: turn.cueIndex,
        transcribed: turn.transcript,
      },
    },
    {
      sessionId,
      userId,
      role: 'bob',
      msgType: 'yl_cue',
      contentText: turn.reaction,
      contentJson: {
        reaction: turn.reaction,
        cue_index: turn.cueIndex,
        ...(turn.evalResult ? { eval: turn.evalResult } : {}),
      },
    },
  ]);

  if ('error' in result) {
    console.error(JSON.stringify({ event: 'saveYLTurnAction', error: result.error }));
    return fail('persist_failed', true);
  }
  return ok({ saved: result.ids.length });
}
