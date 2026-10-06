'use server';

import { completeActivity } from '@/lib/session/complete';
import {
  CLOSED_ANSWER_KIND,
  CLOSED_PLAN_KIND,
  buildClosedEvaluation,
  scoreClosedEntries,
  type ClosedEntry,
  type ClosedEntryResult,
} from '@/lib/toefl/closed-set';

const CLOSED_SET_MODES = ['toefl_listen_choose_response', 'toefl_writing_build_sentence'] as const;

type ClosedSetMode = (typeof CLOSED_SET_MODES)[number];

export interface ClosedSetSubmission {
  mode: ClosedSetMode;
  sessionId?: string;
  items: unknown[];
  entries: ClosedEntry[];
}

export interface ClosedSetOutcome {
  sessionId: string;
  results: ClosedEntryResult[];
}

/**
 * @param input - mode, items shown and the answers given
 * @returns graded results; the session is created here, on the first turn, and closed with its 0-10 grade
 */
export async function submitClosedSetAction(input: ClosedSetSubmission): Promise<ClosedSetOutcome | { error: string }> {
  if (!CLOSED_SET_MODES.includes(input.mode) || input.entries.length === 0) return { error: 'invalid_submission' };
  const results = scoreClosedEntries(input.entries);
  const completed = await completeActivity({
    mode: input.mode,
    sessionId: input.sessionId,
    plan: { kind: CLOSED_PLAN_KIND, items: input.items },
    answers: input.entries.map((entry) => ({ kind: CLOSED_ANSWER_KIND, id: entry.id, selected: entry.selected })),
    evaluation: buildClosedEvaluation(results),
  });
  if (!completed.ok) return { error: completed.code };
  return { sessionId: completed.data.sessionId, results };
}
