'use server';

import { gradePracticeSession, type PracticeTurnSignal } from '@/lib/grading/practice-rubric';
import { closePracticeSessionAction } from './repository';
import type { PracticeRubricDetail } from '@/lib/practice/types';

export interface FinishPracticeResult {
  score: number;
  detail: PracticeRubricDetail;
  feedback: string;
  persisted: boolean;
}

/**
 * @param sessionId string | null
 * @param turnSignals PracticeTurnSignal[]
 */
export async function finishPracticeAction(
  sessionId: string | null,
  turnSignals: PracticeTurnSignal[]
): Promise<FinishPracticeResult> {
  const { score, detail, feedback } = gradePracticeSession(turnSignals);

  let persisted = false;
  if (sessionId) {
    const result = await closePracticeSessionAction({ sessionId, rubricScore: score, rubricDetail: detail });
    persisted = result.ok;
  }

  return { score, detail, feedback, persisted };
}
