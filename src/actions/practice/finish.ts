'use server';

import { gradePracticeSession, type PracticeTurnSignal } from '@/lib/grading/practice-rubric';
import { finishSession, currentUserId } from '@/lib/session/lifecycle';
import { buildPracticeResultEvaluation } from '@/lib/practice/messages';
import { closePracticeSidecar } from '@/lib/practice/sidecar';
import type { PracticeRubricDetail } from '@/lib/practice/types';

export interface FinishPracticeResult {
  score: number;
  detail: PracticeRubricDetail;
  feedback: string;
  persisted: boolean;
}

/**
 * @param sessionId - session created at the first exchange; null when there was none
 * @param turnSignals - scaffolding and score signals of every student turn
 * @returns rubric grade 0-10 computed in code; the session keeps it as score_10 and never counts toward progress
 */
export async function finishPracticeAction(
  sessionId: string | null,
  turnSignals: PracticeTurnSignal[]
): Promise<FinishPracticeResult> {
  const graded = gradePracticeSession(turnSignals);
  if (!sessionId) return { ...graded, persisted: true };

  const userId = await currentUserId();
  if (!userId) return { ...graded, persisted: false };

  const closed = await closePracticeSidecar({
    sessionId,
    userId,
    turnCount: turnSignals.length,
    score: graded.score,
    detail: graded.detail,
  });
  if (!closed.ok) return { ...graded, persisted: false };

  const finished = await finishSession({
    sessionId,
    userId,
    evaluation: buildPracticeResultEvaluation(graded),
    countsTowardProgress: false,
  });
  return { ...graded, persisted: finished.ok };
}
